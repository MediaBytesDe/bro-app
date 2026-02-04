"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Calendar,
  Clock,
  MessageSquare,
  CalendarClock,
  Ban,
  Check,
  X,
  User,
  Send,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  created_at: string;
  read_at: string | null;
}

interface AppointmentResponse {
  id: string;
  response_type: string;
  proposed_date: string | null;
  proposed_time_start: string | null;
  proposed_time_end: string | null;
  message: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
  appointment: {
    id: string;
    title: string;
    date: string;
    time_start: string | null;
    time_end: string | null;
  } | null;
  customer: {
    id: string;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  messages?: Message[];
}

const responseTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  reschedule: { icon: CalendarClock, label: "Verschiebung", color: "text-orange-400 bg-orange-500/10" },
  time_change: { icon: Clock, label: "Uhrzeitänderung", color: "text-blue-400 bg-blue-500/10" },
  comment: { icon: MessageSquare, label: "Kommentar", color: "text-purple-400 bg-purple-500/10" },
  decline: { icon: Ban, label: "Ablehnung", color: "text-red-400 bg-red-500/10" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Offen", color: "bg-yellow-500/20 text-yellow-400" },
  accepted: { label: "Akzeptiert", color: "bg-green-500/20 text-green-400" },
  rejected: { label: "Abgelehnt", color: "bg-red-500/20 text-red-400" },
  resolved: { label: "Erledigt", color: "bg-neutral-500/20 text-neutral-400" },
  counter: { label: "Gegenvorschlag", color: "bg-orange-500/20 text-orange-400" },
  counter_accepted: { label: "Angenommen", color: "bg-green-500/20 text-green-400" },
  counter_rejected: { label: "Abgelehnt", color: "bg-red-500/20 text-red-400" },
};

export default function TerminAnfragenPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<AppointmentResponse[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);
  const [partnerUserName, setPartnerUserName] = useState<string>("");
  
  // Chat Dialog State
  const [selectedResponse, setSelectedResponse] = useState<AppointmentResponse | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Counter Proposal State
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [counterDate, setCounterDate] = useState("");
  const [counterTimeStart, setCounterTimeStart] = useState("");
  const [counterTimeEnd, setCounterTimeEnd] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [submittingCounter, setSubmittingCounter] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadResponses();

    const channel = supabase
      .channel("appointment_responses_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_responses" }, () => loadResponses())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  // Polling für Chat-Nachrichten wenn Dialog offen (alle 2 Sekunden)
  useEffect(() => {
    if (!selectedResponse) return;

    const pollMessages = async () => {
      const { data } = await supabase
        .from("appointment_response_messages")
        .select("*")
        .eq("response_id", selectedResponse.id)
        .order("created_at");
      
      if (data) {
        setChatMessages(data);
      }
    };

    pollMessages();
    const interval = setInterval(pollMessages, 2000);

    return () => clearInterval(interval);
  }, [selectedResponse?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadResponses() {
    if (!profile?.auth_id) {
      setLoading(false);
      return;
    }

    try {
      const { data: partnerUser } = await supabase
        .from("partner_users")
        .select("id, partner_id, display_name")
        .eq("auth_user_id", profile.auth_id)
        .single();

      if (!partnerUser) {
        setLoading(false);
        return;
      }

      setPartnerId(partnerUser.partner_id);
      setPartnerUserId(partnerUser.id);
      setPartnerUserName(partnerUser.display_name || "Partner");

      const { data: jobs } = await supabase
        .from("partner_jobs")
        .select("id")
        .eq("accepted_by_partner_id", partnerUser.partner_id);

      if (!jobs || jobs.length === 0) {
        setLoading(false);
        return;
      }

      const { data: appointments } = await supabase
        .from("partner_job_appointments")
        .select("id")
        .in("job_id", jobs.map(j => j.id));

      if (!appointments || appointments.length === 0) {
        setLoading(false);
        return;
      }

      const appointmentIds = appointments.map(a => a.id);

      const { data: responsesData } = await supabase
        .from("appointment_responses")
        .select(`
          id, response_type, proposed_date, proposed_time_start, proposed_time_end,
          message, status, created_at, read_at,
          customer:customers(id, company_name, first_name, last_name)
        `)
        .in("partner_appointment_id", appointmentIds)
        .order("created_at", { ascending: false });

      // Enrich with appointment details
      const enrichedResponses = await Promise.all(
        (responsesData || []).map(async (r: any) => {
          const { data: apptResponse } = await supabase
            .from("appointment_responses")
            .select("partner_appointment_id")
            .eq("id", r.id)
            .single();

          let appointment = null;
          if (apptResponse?.partner_appointment_id) {
            const { data: appt } = await supabase
              .from("partner_job_appointments")
              .select("id, title, date, time_start, time_end")
              .eq("id", apptResponse.partner_appointment_id)
              .single();
            appointment = appt;
          }

          return { ...r, appointment };
        })
      );

      setResponses(enrichedResponses);
    } catch (err) {
      console.error("Error loading responses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadChatMessages(responseId: string) {
    const { data } = await supabase
      .from("appointment_response_messages")
      .select("*")
      .eq("response_id", responseId)
      .order("created_at", { ascending: true });

    setChatMessages(data || []);
  }

  async function openChat(response: AppointmentResponse) {
    setSelectedResponse(response);
    setShowCounterForm(false);
    setCounterDate(response.appointment?.date || "");
    setCounterTimeStart(response.appointment?.time_start?.slice(0, 5) || "");
    setCounterTimeEnd(response.appointment?.time_end?.slice(0, 5) || "");
    setCounterMessage("");
    await loadChatMessages(response.id);

    // Mark as read
    if (!response.read_at) {
      await supabase
        .from("appointment_responses")
        .update({ read_at: new Date().toISOString(), read_by_type: "partner" })
        .eq("id", response.id);

      setResponses(responses.map(r =>
        r.id === response.id ? { ...r, read_at: new Date().toISOString() } : r
      ));
    }
  }

  async function sendCounterProposal() {
    if (!selectedResponse || !partnerId || !counterDate) {
      toast.error("Bitte Datum angeben");
      return;
    }

    setSubmittingCounter(true);

    // Neuen Response mit status "counter" erstellen (response_type bleibt "reschedule" wegen DB-Constraint)
    const { data: newResponse, error } = await supabase
      .from("appointment_responses")
      .insert({
        customer_id: selectedResponse.customer?.id,
        partner_appointment_id: selectedResponse.appointment?.id,
        response_type: "reschedule", // CHECK-Constraint erlaubt nur bestimmte Werte
        proposed_date: counterDate,
        proposed_time_start: counterTimeStart || null,
        proposed_time_end: counterTimeEnd || null,
        message: counterMessage.trim() || null,
        status: "counter", // Status zeigt an dass es ein Gegenvorschlag vom Partner ist
      })
      .select()
      .single();

    if (error) {
      console.error("Counter proposal error:", JSON.stringify(error, null, 2));
      toast.error(`Fehler: ${error.message || error.code || "Unbekannter Fehler"}`);
      setSubmittingCounter(false);
      return;
    }

    // Original-Anfrage als "resolved" markieren (weil Gegenvorschlag gemacht)
    await supabase
      .from("appointment_responses")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", selectedResponse.id);

    // Notification an Kunden
    if (selectedResponse.customer) {
      await supabase.from("notifications").insert({
        recipient_type: "customer",
        recipient_id: selectedResponse.customer.id,
        type: "appointment_response",
        title: "Gegenvorschlag zu Ihrer Termin-Anfrage",
        body: `Neuer Terminvorschlag: ${new Date(counterDate).toLocaleDateString("de-DE")}${counterTimeStart ? ` um ${counterTimeStart}` : ""}`,
        action_url: "/portal/termine",
      });
    }

    toast.success("Gegenvorschlag gesendet");
    setSubmittingCounter(false);
    setShowCounterForm(false);
    setSelectedResponse(null);
    loadResponses();
  }

  async function sendReply() {
    if (!selectedResponse || !replyMessage.trim() || !partnerUserId) return;

    setSending(true);

    const payload = {
      response_id: selectedResponse.id,
      sender_type: "partner",
      sender_id: partnerUserId,
      sender_name: partnerUserName,
      message: replyMessage.trim(),
    };
    console.log("Sending message payload:", payload);

    const { error } = await supabase
      .from("appointment_response_messages")
      .insert(payload);

    if (error) {
      console.error("Message error:", error.message, error.details, error.hint, error.code);
      toast.error(`Fehler: ${error.message}`);
      setSending(false);
      return;
    }

    // Notification an Kunden
    if (selectedResponse.customer) {
      await supabase.from("notifications").insert({
        recipient_type: "customer",
        recipient_id: selectedResponse.customer.id,
        type: "appointment_response",
        title: "Neue Antwort zu Ihrer Termin-Anfrage",
        body: replyMessage.trim().slice(0, 100),
        action_url: "/portal/termine",
      });
    }

    setReplyMessage("");
    await loadChatMessages(selectedResponse.id);
    setSending(false);
  }

  async function updateStatus(id: string, newStatus: "accepted" | "rejected" | "resolved") {
    const response = responses.find(r => r.id === id);
    if (!response) return;

    // Wenn akzeptiert: Ursprünglichen Termin aktualisieren
    if (newStatus === "accepted" && response.appointment) {
      const appointmentId = response.appointment.id;
      
      if (response.response_type === "reschedule" || response.response_type === "time_change") {
        // Termin mit neuen Daten aktualisieren
        const updateData: any = {};
        if (response.proposed_date) updateData.date = response.proposed_date;
        if (response.proposed_time_start) updateData.time_start = response.proposed_time_start;
        if (response.proposed_time_end) updateData.time_end = response.proposed_time_end;
        
        if (Object.keys(updateData).length > 0) {
          const { error: apptError } = await supabase
            .from("partner_job_appointments")
            .update(updateData)
            .eq("id", appointmentId);
          
          if (apptError) {
            toast.error("Fehler beim Aktualisieren des Termins");
            console.error("Appointment update error:", apptError);
            return;
          }
        }
      } else if (response.response_type === "decline") {
        // Kunde hat abgelehnt - Termin löschen oder als abgesagt markieren
        const { error: deleteError } = await supabase
          .from("partner_job_appointments")
          .delete()
          .eq("id", appointmentId);
        
        if (deleteError) {
          toast.error("Fehler beim Löschen des Termins");
          console.error("Appointment delete error:", deleteError);
          return;
        }
      }
    }

    // Status der Anfrage aktualisieren
    const { error } = await supabase
      .from("appointment_responses")
      .update({ status: newStatus, resolved_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Aktualisieren");
      return;
    }

    const actionText = newStatus === "accepted" 
      ? (response.response_type === "decline" ? "Termin abgesagt" : "Akzeptiert & Termin aktualisiert")
      : newStatus === "rejected" ? "Abgelehnt" : "Erledigt";
    
    toast.success(actionText);
    setResponses(responses.map(r => r.id === id ? { ...r, status: newStatus } : r));

    // Notification an Kunden
    if (response?.customer) {
      const notificationBody = newStatus === "accepted" && response.response_type !== "decline"
        ? `Ihre Terminänderung für "${response.appointment?.title}" wurde übernommen.`
        : newStatus === "accepted" && response.response_type === "decline"
        ? `Der Termin "${response.appointment?.title}" wurde abgesagt.`
        : `Ihre Anfrage zu "${response.appointment?.title}" wurde abgelehnt.`;

      await supabase.from("notifications").insert({
        recipient_type: "customer",
        recipient_id: response.customer.id,
        type: "appointment_response",
        title: `Termin-Anfrage ${newStatus === "accepted" ? "akzeptiert" : "abgelehnt"}`,
        body: notificationBody,
        action_url: "/portal/termine",
      });
    }
  }

  function formatCustomerName(customer: AppointmentResponse["customer"]) {
    if (!customer) return "Unbekannt";
    if (customer.company_name) return customer.company_name;
    return [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Kunde";
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  const filteredResponses = filter === "pending"
    ? responses.filter(r => r.status === "pending")
    : responses;

  const pendingCount = responses.filter(r => r.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Termin-Anfragen</h1>
          <p className="text-neutral-400 mt-1">
            {pendingCount > 0 ? `${pendingCount} offene Anfragen` : "Keine offenen Anfragen"}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("pending")}
          className={cn(
            "px-4 py-2 text-sm rounded-lg transition-colors",
            filter === "pending" ? "bg-[#fa432a] text-white" : "bg-[#111] text-neutral-400 hover:text-white"
          )}
        >
          Offen ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-4 py-2 text-sm rounded-lg transition-colors",
            filter === "all" ? "bg-[#fa432a] text-white" : "bg-[#111] text-neutral-400 hover:text-white"
          )}
        >
          Alle ({responses.length})
        </button>
      </div>

      {/* Responses Table */}
      {filteredResponses.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">
            {filter === "pending" ? "Keine offenen Anfragen" : "Keine Termin-Anfragen"}
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left py-3 px-4">Anfrage</th>
                <th className="text-left py-3 px-4 w-48">Termin</th>
                <th className="text-left py-3 px-4 w-40">Kunde</th>
                <th className="text-left py-3 px-4 w-36">Vorschlag</th>
                <th className="text-left py-3 px-4 w-28">Status</th>
                <th className="w-36"></th>
              </tr>
            </thead>
            <tbody>
              {filteredResponses.map((response) => {
                const typeConfig = responseTypeConfig[response.response_type] || responseTypeConfig.comment;
                const TypeIcon = typeConfig.icon;
                const status = statusConfig[response.status] || statusConfig.pending;
                const isPending = response.status === "pending";

                return (
                  <tr
                    key={response.id}
                    className={cn(
                      "border-b border-neutral-800/50 last:border-0 transition-colors cursor-pointer",
                      isPending ? "bg-[#111] hover:bg-[#151515]" : "hover:bg-[#0d0d0d]"
                    )}
                    onClick={() => openChat(response)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg", typeConfig.color)}>
                          <TypeIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{typeConfig.label}</p>
                          {response.message && (
                            <p className="text-sm text-neutral-500 mt-0.5 line-clamp-1 max-w-xs">
                              "{response.message}"
                            </p>
                          )}
                          <p className="text-xs text-neutral-600 mt-1">
                            {new Date(response.created_at).toLocaleDateString("de-DE", {
                              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {response.appointment ? (
                        <div>
                          <p className="text-white text-sm">{response.appointment.title}</p>
                          <p className="text-xs text-neutral-500">
                            {new Date(response.appointment.date).toLocaleDateString("de-DE")}
                            {response.appointment.time_start && ` ${response.appointment.time_start.slice(0, 5)}`}
                          </p>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm text-neutral-300">{formatCustomerName(response.customer)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {response.proposed_date || response.proposed_time_start ? (
                        <div className="text-sm">
                          {response.proposed_date && (
                            <p className="text-white">{new Date(response.proposed_date).toLocaleDateString("de-DE")}</p>
                          )}
                          {response.proposed_time_start && (
                            <p className="text-neutral-400">
                              {response.proposed_time_start.slice(0, 5)}
                              {response.proposed_time_end && ` – ${response.proposed_time_end.slice(0, 5)}`}
                            </p>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn("text-xs px-2 py-1 rounded whitespace-nowrap", status.color)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openChat(response)}
                          className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 rounded transition-colors"
                          title="Antworten"
                        >
                          <MessageSquare className="w-4 h-4 text-blue-400" />
                        </button>
                        {isPending && (
                          <>
                            <button
                              onClick={() => updateStatus(response.id, "accepted")}
                              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded transition-colors"
                              title="Akzeptieren"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                            </button>
                            <button
                              onClick={() => updateStatus(response.id, "rejected")}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded transition-colors"
                              title="Ablehnen"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Chat Dialog */}
      {selectedResponse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Konversation</h3>
                <p className="text-sm text-neutral-500">
                  {formatCustomerName(selectedResponse.customer)} · {selectedResponse.appointment?.title}
                </p>
              </div>
              <button onClick={() => setSelectedResponse(null)} className="p-1 hover:bg-[#1a1a1a] rounded">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {/* Original Request */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{formatCustomerName(selectedResponse.customer)}</span>
                    <span className="text-xs text-neutral-500">{formatTime(selectedResponse.created_at)}</span>
                  </div>
                  <div className="mt-1 p-3 bg-[#111] rounded-lg rounded-tl-none">
                    <p className="text-xs text-neutral-400 mb-1">
                      {responseTypeConfig[selectedResponse.response_type]?.label}
                      {selectedResponse.proposed_date && ` → ${new Date(selectedResponse.proposed_date).toLocaleDateString("de-DE")}`}
                      {selectedResponse.proposed_time_start && ` ${selectedResponse.proposed_time_start.slice(0, 5)}`}
                    </p>
                    {selectedResponse.message && (
                      <p className="text-white text-sm">{selectedResponse.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              {chatMessages.map((msg) => {
                const isPartner = msg.sender_type === "partner";
                return (
                  <div key={msg.id} className={cn("flex gap-3", isPartner && "flex-row-reverse")}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      isPartner ? "bg-[#fa432a]/20" : "bg-blue-500/20"
                    )}>
                      <User className={cn("w-4 h-4", isPartner ? "text-[#fa432a]" : "text-blue-400")} />
                    </div>
                    <div className={cn("flex-1", isPartner && "text-right")}>
                      <div className={cn("flex items-center gap-2", isPartner && "justify-end")}>
                        <span className="text-sm font-medium text-white">{msg.sender_name || (isPartner ? "Partner" : "Kunde")}</span>
                        <span className="text-xs text-neutral-500">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className={cn(
                        "mt-1 p-3 rounded-lg inline-block max-w-[80%]",
                        isPartner ? "bg-[#fa432a]/20 rounded-tr-none text-left" : "bg-[#111] rounded-tl-none"
                      )}>
                        <p className="text-white text-sm">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-neutral-800">
              <div className="flex gap-2">
                <input
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                  placeholder="Antwort schreiben..."
                  className="flex-1 bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#fa432a]"
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyMessage.trim()}
                  className="px-4 py-2 bg-[#fa432a] hover:bg-[#e03d26] disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {sending ? <Spinner className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                </button>
              </div>

              {/* Status Actions */}
              {selectedResponse.status === "pending" && !showCounterForm && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { updateStatus(selectedResponse.id, "accepted"); setSelectedResponse(null); }}
                    className="flex-1 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Akzeptieren
                  </button>
                  <button
                    onClick={() => setShowCounterForm(true)}
                    className="flex-1 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <CalendarClock className="w-4 h-4" /> Gegenvorschlag
                  </button>
                  <button
                    onClick={() => { updateStatus(selectedResponse.id, "rejected"); setSelectedResponse(null); }}
                    className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> Ablehnen
                  </button>
                </div>
              )}

              {/* Counter Proposal Form */}
              {showCounterForm && (
                <div className="mt-3 p-4 bg-[#0a0a0a] rounded-lg space-y-3">
                  <p className="text-sm font-medium text-white">Gegenvorschlag machen</p>
                  
                  <div>
                    <label className="text-xs text-neutral-500">Neues Datum *</label>
                    <input
                      type="date"
                      value={counterDate}
                      onChange={(e) => setCounterDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-neutral-500">Von</label>
                      <input
                        type="time"
                        value={counterTimeStart}
                        onChange={(e) => setCounterTimeStart(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500">Bis</label>
                      <input
                        type="time"
                        value={counterTimeEnd}
                        onChange={(e) => setCounterTimeEnd(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-neutral-500">Nachricht (optional)</label>
                    <textarea
                      value={counterMessage}
                      onChange={(e) => setCounterMessage(e.target.value)}
                      placeholder="z.B. Der ursprüngliche Termin passt leider nicht..."
                      rows={2}
                      className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1 resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCounterForm(false)}
                      className="flex-1 py-2 bg-[#1a1a1a] text-neutral-400 rounded-lg text-sm"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={sendCounterProposal}
                      disabled={submittingCounter || !counterDate}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                    >
                      {submittingCounter ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" /> Senden</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
