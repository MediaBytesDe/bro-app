"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  X,
  CalendarClock,
  Clock,
  Ban,
  Send,
  CheckCheck,
  Check,
  User,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Appointment {
  id: string;
  title: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  notes: string | null;
  partner_name: string | null;
  partner_id: string | null;
  trade: string | null;
  is_partner: boolean;
}

interface Response {
  id: string;
  response_type: string;
  proposed_date: string | null;
  proposed_time_start: string | null;
  message: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
  read_by_type: string | null;
}

interface Message {
  id: string;
  sender_type: string;
  sender_name: string | null;
  message: string;
  created_at: string;
}

export default function TerminePage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"upcoming" | "all">("upcoming");
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightId);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  
  // Detail Dialog
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [aptResponses, setAptResponses] = useState<Response[]>([]);
  const [activeResponse, setActiveResponse] = useState<Response | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  
  // New Request Form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState<string>("comment");
  const [newDate, setNewDate] = useState("");
  const [newTimeStart, setNewTimeStart] = useState("");
  const [newTimeEnd, setNewTimeEnd] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.auth_id) loadData();
  }, [profile, currentMonth]);

  // Auto-open highlighted appointment
  useEffect(() => {
    if (highlightId && appointments.length > 0 && !selectedApt) {
      const apt = appointments.find(a => a.id === highlightId);
      if (apt) {
        openDetail(apt);
        // Clear highlight after opening
        setTimeout(() => setHighlightedId(null), 2000);
      }
    }
  }, [highlightId, appointments]);

  // Polling für Chat-Nachrichten (alle 2 Sekunden wenn Chat offen)
  useEffect(() => {
    if (!activeResponse) return;

    const pollMessages = async () => {
      const { data } = await supabase
        .from("appointment_response_messages")
        .select("*")
        .eq("response_id", activeResponse.id)
        .order("created_at");
      
      if (data) {
        setMessages(data);
      }
    };

    pollMessages();
    const interval = setInterval(pollMessages, 2000);

    return () => clearInterval(interval);
  }, [activeResponse?.id]);

  // Auto-scroll bei neuen Nachrichten
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadData() {
    if (!profile?.auth_id) {
      setLoading(false);
      return;
    }

    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);
      
      let customer: any = null;
      
      if (isImpersonating && impersonateId) {
        // Admin impersonating - load the impersonated customer
        const { data } = await supabase
          .from("customers")
          .select("id, first_name, last_name, company_name")
          .eq("id", impersonateId)
          .single();
        customer = data;
      } else {
        // Normal customer
        const { data } = await supabase
          .from("customers")
          .select("id, first_name, last_name, company_name")
          .eq("auth_user_id", profile.auth_id)
          .single();
        customer = data;
      }

      if (!customer) { setLoading(false); return; }
      
      setCustomerId(customer.id);
      setCustomerName(customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Kunde");

      const { data: projects } = await supabase
        .from("projects").select("id, name").eq("customer_id", customer.id);

      if (!projects?.length) { setLoading(false); return; }

      const { data: jobs } = await supabase
        .from("partner_jobs")
        .select("id, trade, project_id, accepted_by_partner_id, partner:partners!accepted_by_partner_id(company_name)")
        .in("project_id", projects.map(p => p.id))
        .not("status", "eq", "declined");

      if (!jobs?.length) { setLoading(false); return; }

      const jobInfo = Object.fromEntries(jobs.map(j => [j.id, j]));
      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data: appts } = await supabase
        .from("partner_job_appointments")
        .select("*")
        .in("job_id", jobs.map(j => j.id))
        .gte("date", start.toISOString().split('T')[0])
        .lte("date", end.toISOString().split('T')[0])
        .order("date");

      setAppointments((appts || []).map(a => {
        const job = jobInfo[a.job_id];
        return {
          id: a.id, title: a.title, date: a.date,
          time_start: a.time_start, time_end: a.time_end, notes: a.notes,
          partner_name: (job?.partner as any)?.company_name || null,
          partner_id: job?.accepted_by_partner_id || null,
          trade: job?.trade || null, is_partner: true,
        };
      }));
    } catch (err) {
      console.error("Error loading termine:", err);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(apt: Appointment) {
    setSelectedApt(apt);
    setShowNewForm(false);
    setActiveResponse(null);
    setMessages([]);
    setChatReply("");
    setNewType("comment");
    setNewDate(apt.date);
    setNewTimeStart(apt.time_start?.slice(0, 5) || "");
    setNewTimeEnd(apt.time_end?.slice(0, 5) || "");
    setNewMessage("");

    if (customerId) {
      const { data } = await supabase
        .from("appointment_responses")
        .select("*")
        .eq("partner_appointment_id", apt.id)
        .eq("customer_id", customerId)
        .order("created_at");
      
      setAptResponses(data || []);
      if (data?.length) {
        setActiveResponse(data[data.length - 1]);
        await loadMessages(data[data.length - 1].id);
      }
    }
  }

  async function loadMessages(responseId: string) {
    const { data } = await supabase
      .from("appointment_response_messages")
      .select("*")
      .eq("response_id", responseId)
      .order("created_at");
    setMessages(data || []);
  }

  async function sendReply() {
    if (!activeResponse || !chatReply.trim() || !customerId || !selectedApt) return;
    setSendingChat(true);

    await supabase.from("appointment_response_messages").insert({
      response_id: activeResponse.id,
      sender_type: "customer",
      sender_id: customerId,
      sender_name: customerName,
      message: chatReply.trim(),
    });

    // Notification an Partner senden
    if (selectedApt.partner_id) {
      const { data: partnerUsers } = await supabase
        .from("partner_users")
        .select("id")
        .eq("partner_id", selectedApt.partner_id);

      if (partnerUsers?.length) {
        await supabase.from("notifications").insert(
          partnerUsers.map(u => ({
            recipient_type: "partner_user",
            recipient_id: u.id,
            type: "chat_message",
            title: "Neue Nachricht",
            body: `${customerName}: ${chatReply.trim().slice(0, 60)}${chatReply.length > 60 ? "..." : ""}`,
            action_url: "/partner/termin-anfragen",
          }))
        );
      }
    }

    setChatReply("");
    await loadMessages(activeResponse.id);
    setSendingChat(false);
  }

  async function submitNewRequest() {
    if (!selectedApt || !customerId) return;
    if ((newType === "comment" || newType === "decline") && !newMessage.trim()) {
      toast.error("Bitte Nachricht eingeben");
      return;
    }
    if (newType === "reschedule" && !newDate) {
      toast.error("Bitte Datum wählen");
      return;
    }

    setSubmitting(true);

    const payload: any = {
      customer_id: customerId,
      partner_appointment_id: selectedApt.id,
      response_type: newType,
      message: newMessage.trim() || null,
      status: "pending",
    };
    if (newType === "reschedule") payload.proposed_date = newDate;
    if (newTimeStart) payload.proposed_time_start = newTimeStart;
    if (newTimeEnd) payload.proposed_time_end = newTimeEnd;

    const { data, error } = await supabase
      .from("appointment_responses")
      .insert(payload)
      .select()
      .single();

    if (error) {
      toast.error(`Fehler: ${error.message}`);
      setSubmitting(false);
      return;
    }

    // Notification an Partner
    if (selectedApt.partner_id) {
      const { data: users } = await supabase
        .from("partner_users")
        .select("id")
        .eq("partner_id", selectedApt.partner_id)
        .eq("role", "admin");

      if (users?.length) {
        await supabase.from("notifications").insert(
          users.map(u => ({
            recipient_type: "partner_user",
            recipient_id: u.id,
            type: "appointment_response",
            title: newType === "decline" ? "Termin abgelehnt" : "Neue Termin-Anfrage",
            body: `Kunde: ${newMessage.trim().slice(0, 80) || newType}`,
            action_url: "/partner/termin-anfragen",
          }))
        );
      }
    }

    toast.success("Anfrage gesendet");
    setSubmitting(false);
    setShowNewForm(false);
    setNewMessage("");
    
    // Refresh
    setAptResponses([...aptResponses, data]);
    setActiveResponse(data);
    setMessages([]);
  }

  async function respondToCounterProposal(responseId: string, accept: boolean) {
    const response = aptResponses.find(r => r.id === responseId);
    if (!response || !selectedApt) return;

    setSubmitting(true);
    const newStatus = accept ? "counter_accepted" : "counter_rejected";

    // Status der Counter-Proposal aktualisieren
    const { error } = await supabase
      .from("appointment_responses")
      .update({ status: newStatus, resolved_at: new Date().toISOString() })
      .eq("id", responseId);

    if (error) {
      toast.error(`Fehler: ${error.message}`);
      setSubmitting(false);
      return;
    }

    // Wenn akzeptiert: Termin mit den vorgeschlagenen Daten aktualisieren
    if (accept && response.proposed_date) {
      const updateData: any = { date: response.proposed_date };
      if (response.proposed_time_start) updateData.time_start = response.proposed_time_start;
      if (response.proposed_time_end) updateData.time_end = response.proposed_time_end;

      await supabase
        .from("partner_job_appointments")
        .update(updateData)
        .eq("id", selectedApt.id);
    }

    // Notification an Partner
    if (selectedApt.partner_id) {
      const { data: users } = await supabase
        .from("partner_users")
        .select("id")
        .eq("partner_id", selectedApt.partner_id);

      if (users?.length) {
        await supabase.from("notifications").insert(
          users.map(u => ({
            recipient_type: "partner_user",
            recipient_id: u.id,
            type: "appointment_response",
            title: accept ? "Gegenvorschlag angenommen" : "Gegenvorschlag abgelehnt",
            body: accept 
              ? `Der Kunde hat Ihren Terminvorschlag für "${selectedApt.title}" angenommen.`
              : `Der Kunde hat Ihren Terminvorschlag für "${selectedApt.title}" abgelehnt.`,
            action_url: "/partner/termin-anfragen",
          }))
        );
      }
    }

    toast.success(accept ? "Gegenvorschlag angenommen – Termin aktualisiert" : "Gegenvorschlag abgelehnt");
    setSubmitting(false);
    
    // Refresh
    setAptResponses(aptResponses.map(r => r.id === responseId ? { ...r, status: newStatus } : r));
    if (accept) {
      setSelectedApt(null);
      loadData(); // Refresh appointments
    }
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = appointments.filter(a => new Date(a.date) >= today);
  const displayed = view === "upcoming" ? upcoming : appointments;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Termine</h1>
          <p className="text-neutral-400 mt-1">Klicken Sie auf einen Termin für Details</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg">
            <ChevronLeft className="w-5 h-5 text-neutral-400" />
          </button>
          <span className="text-white font-medium min-w-[140px] text-center">
            {currentMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg">
            <ChevronRight className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{upcoming.length}</p>
          <p className="text-xs text-neutral-500 uppercase">Anstehend</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{appointments.length}</p>
          <p className="text-xs text-neutral-500 uppercase">Gesamt (Monat)</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["upcoming", "all"].map(v => (
          <button key={v} onClick={() => setView(v as any)}
            className={cn("px-4 py-2 text-sm rounded-lg", view === v ? "bg-[#fa432a] text-white" : "bg-[#111] text-neutral-400 hover:text-white")}>
            {v === "upcoming" ? "Anstehend" : "Alle"}
          </button>
        ))}
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400">Keine Termine in diesem Monat</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left py-3 px-4 w-28">Datum</th>
                <th className="text-left py-3 px-4 w-32">Uhrzeit</th>
                <th className="text-left py-3 px-4">Termin</th>
                <th className="text-left py-3 px-4 w-32">Gewerk</th>
                <th className="text-left py-3 px-4 w-48">Partner</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(apt => {
                const d = new Date(apt.date);
                const isPast = d < today;
                const isToday = d.toDateString() === today.toDateString();
                return (
                  <tr key={apt.id} onClick={() => !isPast && openDetail(apt)}
                    className={cn(
                      "border-b border-neutral-800/50 last:border-0", 
                      isPast ? "opacity-50" : "hover:bg-[#111] cursor-pointer", 
                      isToday && "bg-[#fa432a]/5",
                      highlightedId === apt.id && "bg-[#fa432a]/20 ring-1 ring-[#fa432a]"
                    )}>
                    <td className="py-3 px-4">
                      <p className={cn("text-sm font-medium", isToday ? "text-[#fa432a]" : "text-white")}>
                        {d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric" })}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-300">
                      {apt.time_start ? `${apt.time_start.slice(0,5)}${apt.time_end ? ` – ${apt.time_end.slice(0,5)}` : ""}` : "Ganztägig"}
                    </td>
                    <td className="py-3 px-4 text-white">{apt.title}</td>
                    <td className="py-3 px-4">
                      {apt.trade && <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300">{getTradeLabel(apt.trade)}</span>}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-400">{apt.partner_name || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="p-4 border-b border-neutral-800 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedApt.title}</h3>
                <p className="text-sm text-neutral-400">
                  {new Date(selectedApt.date).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
                  {selectedApt.time_start && ` · ${selectedApt.time_start.slice(0,5)}`}
                  {selectedApt.time_end && ` – ${selectedApt.time_end.slice(0,5)}`}
                </p>
                {selectedApt.partner_name && <p className="text-xs text-neutral-500 mt-1">{selectedApt.partner_name}</p>}
              </div>
              <button onClick={() => setSelectedApt(null)} className="p-1 hover:bg-[#1a1a1a] rounded">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Existing Responses */}
              {aptResponses.length > 0 && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Anfragen & Vorschläge</p>
                  <div className="space-y-2">
                    {aptResponses.map(r => {
                      const isCounter = r.status === "counter";
                      const typeLabel = isCounter ? "Gegenvorschlag vom Partner"
                        : r.response_type === "reschedule" ? "Verschiebung" 
                        : r.response_type === "time_change" ? "Uhrzeitänderung" 
                        : r.response_type === "decline" ? "Ablehnung" 
                        : "Kommentar";
                      
                      const statusLabel = r.status === "pending" ? "Offen" 
                        : r.status === "accepted" ? "Akzeptiert" 
                        : r.status === "rejected" ? "Abgelehnt"
                        : r.status === "counter" ? "Wartet auf Ihre Antwort"
                        : r.status === "counter_accepted" ? "Angenommen"
                        : r.status === "counter_rejected" ? "Abgelehnt"
                        : "Erledigt";
                      
                      const statusColor = r.status === "pending" ? "bg-yellow-500/20 text-yellow-400" 
                        : r.status === "accepted" || r.status === "counter_accepted" ? "bg-green-500/20 text-green-400" 
                        : r.status === "rejected" || r.status === "counter_rejected" ? "bg-red-500/20 text-red-400"
                        : r.status === "counter" ? "bg-orange-500/20 text-orange-400"
                        : "bg-neutral-500/20 text-neutral-400";

                      return (
                        <div key={r.id} 
                          onClick={() => { setActiveResponse(r); loadMessages(r.id); setShowNewForm(false); }}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer border", 
                            activeResponse?.id === r.id ? "border-[#fa432a] bg-[#fa432a]/10" : "border-neutral-800 bg-[#111] hover:bg-[#151515]",
                            isCounter && r.status === "counter" && "border-orange-500/50 bg-orange-500/5"
                          )}>
                          <div className="flex items-center justify-between">
                            <span className={cn("text-sm", isCounter ? "text-orange-400 font-medium" : "text-white")}>
                              {typeLabel}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs px-2 py-0.5 rounded", statusColor)}>
                                {statusLabel}
                              </span>
                              {r.read_at && r.read_by_type === "partner" && <CheckCheck className="w-4 h-4 text-blue-400" />}
                            </div>
                          </div>
                          
                          {/* Counter Proposal Details */}
                          {isCounter && r.proposed_date && (
                            <div className="mt-2 p-2 bg-[#0a0a0a] rounded text-sm">
                              <p className="text-white">
                                <span className="text-neutral-500">Vorgeschlagen:</span>{" "}
                                {new Date(r.proposed_date).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" })}
                                {r.proposed_time_start && ` um ${r.proposed_time_start.slice(0, 5)}`}
                                {r.proposed_time_end && ` – ${r.proposed_time_end.slice(0, 5)}`}
                              </p>
                            </div>
                          )}
                          
                          {r.message && <p className="text-xs text-neutral-500 mt-1 line-clamp-1">{r.message}</p>}
                          
                          {/* Accept/Reject Buttons for Counter Proposals */}
                          {isCounter && r.status === "counter" && (
                            <div className="flex gap-2 mt-3" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => respondToCounterProposal(r.id, true)}
                                disabled={submitting}
                                className="flex-1 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded text-xs flex items-center justify-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Annehmen
                              </button>
                              <button
                                onClick={() => respondToCounterProposal(r.id, false)}
                                disabled={submitting}
                                className="flex-1 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs flex items-center justify-center gap-1"
                              >
                                <X className="w-3 h-3" /> Ablehnen
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chat for active response */}
              {activeResponse && !showNewForm && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Konversation</p>
                  <div className="bg-[#0a0a0a] rounded-lg p-3 space-y-3 max-h-[200px] overflow-y-auto">
                    {/* Original */}
                    <div className="flex gap-2">
                      <User className="w-5 h-5 text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-neutral-500">Sie · {new Date(activeResponse.created_at).toLocaleDateString("de-DE")}</p>
                        <p className="text-sm text-white">{activeResponse.message || "(keine Nachricht)"}</p>
                      </div>
                    </div>
                    {/* Messages */}
                    {messages.map(m => (
                      <div key={m.id} className={cn("flex gap-2", m.sender_type === "customer" && "flex-row-reverse")}>
                        <User className={cn("w-5 h-5 mt-0.5", m.sender_type === "customer" ? "text-blue-400" : "text-[#fa432a]")} />
                        <div className={cn("flex-1", m.sender_type === "customer" && "text-right")}>
                          <p className="text-xs text-neutral-500">{m.sender_name || (m.sender_type === "customer" ? "Sie" : "Partner")}</p>
                          <p className={cn("text-sm inline-block px-3 py-1.5 rounded-lg", m.sender_type === "customer" ? "bg-blue-600 text-white" : "bg-[#1a1a1a] text-white")}>
                            {m.message}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  {/* Reply Input */}
                  <div className="flex gap-2 mt-2">
                    <input value={chatReply} onChange={e => setChatReply(e.target.value)} onKeyDown={e => e.key === "Enter" && sendReply()}
                      placeholder="Antworten..." className="flex-1 bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white" />
                    <button onClick={sendReply} disabled={sendingChat || !chatReply.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg">
                      {sendingChat ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* New Request Form */}
              {showNewForm && (
                <div className="bg-[#0a0a0a] rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-white">Neue Anfrage</p>
                  
                  <div className="flex gap-2 flex-wrap">
                    {[{v:"comment",l:"Kommentar"},{v:"reschedule",l:"Verschieben"},{v:"time_change",l:"Uhrzeit"},{v:"decline",l:"Ablehnen"}].map(t => (
                      <button key={t.v} onClick={() => setNewType(t.v)}
                        className={cn("px-3 py-1.5 text-xs rounded-lg", newType === t.v ? "bg-[#fa432a] text-white" : "bg-[#1a1a1a] text-neutral-400")}>
                        {t.l}
                      </button>
                    ))}
                  </div>

                  {newType === "reschedule" && (
                    <div>
                      <label className="text-xs text-neutral-500">Neues Datum</label>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1" />
                    </div>
                  )}

                  {(newType === "reschedule" || newType === "time_change") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-neutral-500">Von</label>
                        <input type="time" value={newTimeStart} onChange={e => setNewTimeStart(e.target.value)}
                          className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1" />
                      </div>
                      <div>
                        <label className="text-xs text-neutral-500">Bis</label>
                        <input type="time" value={newTimeEnd} onChange={e => setNewTimeEnd(e.target.value)}
                          className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-neutral-500">{newType === "decline" ? "Grund" : "Nachricht"}</label>
                    <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} rows={2}
                      placeholder={newType === "decline" ? "Warum passt der Termin nicht?" : "Ihre Nachricht..."}
                      className="w-full bg-[#111] border border-neutral-700 rounded-lg px-3 py-2 text-white mt-1 resize-none" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowNewForm(false)} className="flex-1 py-2 bg-[#1a1a1a] text-neutral-400 rounded-lg text-sm">Abbrechen</button>
                    <button onClick={submitNewRequest} disabled={submitting}
                      className={cn("flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2", newType === "decline" ? "bg-red-600 text-white" : "bg-[#fa432a] text-white")}>
                      {submitting ? <Spinner className="w-4 h-4" /> : <><Send className="w-4 h-4" />Senden</>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!showNewForm && (
              <div className="p-4 border-t border-neutral-800">
                <button onClick={() => { setShowNewForm(true); setActiveResponse(null); }}
                  className="w-full py-2 bg-[#fa432a] hover:bg-[#e03d26] text-white rounded-lg text-sm flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Neue Anfrage
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
