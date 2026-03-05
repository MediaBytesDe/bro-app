"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  X,
  Image as ImageIcon,
  Check,
  Clock,
  ExternalLink,
  Paperclip,
} from "lucide-react";
import {
  INQUIRY_STATUS_MAP,
  URGENCY_MAP,
  RECIPIENT_STATUS_MAP,
  POSITION_CATEGORIES,
} from "@/lib/inquiries/constants";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import { toast } from "sonner";
import type {
  Inquiry,
  InquiryResponse,
  InquiryMessage,
  InquiryRecipient,
  InquiryTemplate,
  InquiryTemplateField,
  ResponsePosition,
  RecipientStatus,
} from "@/lib/inquiries/types";

// Extended Inquiry with joined data from the API
interface InquiryDetail extends Inquiry {
  messages?: InquiryMessage[];
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export default function InquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inquiryId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [template, setTemplate] = useState<InquiryTemplate | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    loadData();
  }, [inquiryId]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`inquiry-${inquiryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "inquiry_messages",
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === (payload.new as InquiryMessage).id)) {
              return prev;
            }
            return [...prev, payload.new as InquiryMessage];
          });
          setTimeout(scrollToBottom, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [inquiryId, scrollToBottom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  async function loadData() {
    try {
      await loadTradesFromDB(supabase, true);

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", id: inquiryId }),
      });

      const result = await res.json();

      if (!res.ok || !result.data) {
        toast.error("Anfrage nicht gefunden");
        router.push("/anfragen");
        return;
      }

      const inq = result.data as InquiryDetail;
      setInquiry(inq);
      setMessages(inq.messages || []);

      // Load template if template_id exists
      if (inq.template_id) {
        const tmplRes = await fetch("/api/inquiries/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", trade: inq.trade }),
        });
        const tmplResult = await tmplRes.json();
        if (tmplResult.data) {
          const found = tmplResult.data.find(
            (t: InquiryTemplate) => t.id === inq.template_id
          );
          if (found) setTemplate(found);
        }
      }
    } catch (err) {
      console.error("Error loading inquiry:", err);
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptResponse(partnerId: string) {
    if (!inquiry) return;
    const confirmed = confirm(
      "Angebot dieses Partners akzeptieren?\n\nAlle anderen Angebote werden automatisch abgelehnt."
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept_response",
          id: inquiry.id,
          partner_id: partnerId,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fehler");
      } else {
        toast.success("Angebot akzeptiert");
        loadData();
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeclineAll() {
    if (!inquiry) return;
    const confirmed = confirm(
      "Alle Angebote ablehnen?\n\nDiese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline_all", id: inquiry.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fehler");
      } else {
        toast.success("Alle Angebote abgelehnt");
        loadData();
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!inquiry) return;
    const confirmed = confirm("Anfrage abschließen?");
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", id: inquiry.id }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fehler");
      } else {
        toast.success("Anfrage abgeschlossen");
        loadData();
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!inquiry || !messageText.trim()) return;

    setSendingMessage(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          id: inquiry.id,
          message: messageText.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Fehler beim Senden");
      } else {
        setMessageText("");
        // Message will appear via realtime subscription, but add it now for instant feedback
        if (result.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === result.data.id)) return prev;
            return [...prev, result.data as InquiryMessage];
          });
        }
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSendingMessage(false);
    }
  }

  function toggleResponseExpanded(partnerId: string) {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
      }
      return next;
    });
  }

  function getResponseForPartner(partnerId: string): InquiryResponse | undefined {
    return inquiry?.responses?.find((r) => r.partner_id === partnerId);
  }

  function getResponsePrice(response: InquiryResponse): number | null {
    if (response.response_type === "quick") {
      return response.quick_price;
    }
    return response.total_amount;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!inquiry) return null;

  const statusInfo = INQUIRY_STATUS_MAP[inquiry.status] || {
    label: inquiry.status,
    class: "bg-neutral-500/20 text-neutral-400",
  };
  const urgencyInfo = URGENCY_MAP[inquiry.urgency] || {
    label: inquiry.urgency,
    class: "bg-neutral-500/20 text-neutral-400",
  };

  const isDraft = inquiry.status === "draft";
  const isAnswered = inquiry.status === "answered";
  const isAccepted = inquiry.status === "accepted";
  const isReadOnly = ["declined", "closed"].includes(inquiry.status);
  const isDirect = inquiry.mode === "direct";
  const recipients = inquiry.recipients || [];
  const responses = inquiry.responses || [];
  const hasResponses = responses.length > 0;

  return (
    <div className="space-y-6 pb-24">
      {/* Back link */}
      <Link
        href="/anfragen"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Liste
      </Link>

      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{inquiry.title}</h1>
            <span className={`text-xs px-2 py-1 rounded ${statusInfo.class}`}>
              {statusInfo.label}
            </span>
            <span className={`text-xs px-2 py-1 rounded ${urgencyInfo.class}`}>
              {urgencyInfo.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-neutral-400">
            <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
              {getTradeLabel(inquiry.trade)}
            </span>
            <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
              {isDirect ? "Direkt" : "Ausschreibung"}
            </span>
            <span>Erstellt: {formatDateShort(inquiry.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* 2. Details Card */}
          {(inquiry.description || inquiry.location_notes || inquiry.project_id) && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#fa432a]" />
                Details
              </h2>
              {inquiry.description && (
                <p className="text-neutral-300 whitespace-pre-wrap mb-4">
                  {inquiry.description}
                </p>
              )}
              {inquiry.location_notes && (
                <div className="flex items-start gap-2 text-neutral-400 text-sm mb-3">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#fa432a]" />
                  <span>{inquiry.location_notes}</span>
                </div>
              )}
              {inquiry.project && (
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="w-4 h-4 text-neutral-500" />
                  <Link
                    href={`/projects/${inquiry.project.id}`}
                    className="text-[#fa432a] hover:underline"
                  >
                    Projekt: {inquiry.project.name}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* 3. Checklist Card */}
          <ChecklistCard
            checklistData={inquiry.checklist_data}
            template={template}
          />

          {/* 4. Photos Gallery */}
          {inquiry.photos && inquiry.photos.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#fa432a]" />
                Fotos ({inquiry.photos.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {inquiry.photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxPhoto(photo)}
                    className="aspect-square rounded-lg overflow-hidden bg-[#0f0f0f] hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={photo}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 5. Recipients & Responses */}
          {recipients.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-4">
                {isDirect
                  ? "Empfänger & Antwort"
                  : `Empfänger & Angebote (${recipients.length})`}
              </h2>

              {isDirect ? (
                <DirectRecipientView
                  recipient={recipients[0]}
                  response={getResponseForPartner(recipients[0]?.partner_id)}
                  onAccept={handleAcceptResponse}
                  onDeclineAll={handleDeclineAll}
                  actionLoading={actionLoading}
                  isAnswered={isAnswered}
                  isReadOnly={isReadOnly}
                />
              ) : (
                <TenderComparisonView
                  recipients={recipients}
                  responses={responses}
                  expandedResponses={expandedResponses}
                  onToggleExpand={toggleResponseExpanded}
                  onAccept={handleAcceptResponse}
                  onDeclineAll={handleDeclineAll}
                  actionLoading={actionLoading}
                  isAnswered={isAnswered}
                  isReadOnly={isReadOnly}
                />
              )}
            </div>
          )}

          {/* 6. Messages Section */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4">Nachrichten</h2>

            {messages.length === 0 ? (
              <p className="text-neutral-500 text-sm text-center py-4">
                Noch keine Nachrichten
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Message input - not shown for closed/declined */}
            {!isReadOnly && (
              <div className="flex gap-2 mt-3">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Nachricht schreiben..."
                  rows={2}
                  className="input flex-1 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                  className="btn-primary self-end px-4 py-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Action Bar */}
          <ActionSidebar
            inquiry={inquiry}
            actionLoading={actionLoading}
            onDeclineAll={handleDeclineAll}
            onClose={handleClose}
            hasResponses={hasResponses}
          />

          {/* Quick Info */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Info</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusInfo.class}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Dringlichkeit</span>
                <span className={`text-xs px-2 py-0.5 rounded ${urgencyInfo.class}`}>
                  {urgencyInfo.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Gewerk</span>
                <span className="text-neutral-300">
                  {getTradeLabel(inquiry.trade)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Modus</span>
                <span className="text-neutral-300">
                  {isDirect ? "Direkt" : "Ausschreibung"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Empfänger</span>
                <span className="text-neutral-300">{recipients.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Erstellt</span>
                <span className="text-neutral-300">
                  {formatDateShort(inquiry.created_at)}
                </span>
              </div>
              {inquiry.project && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Projekt</span>
                  <Link
                    href={`/projects/${inquiry.project.id}`}
                    className="text-[#fa432a] hover:underline text-right truncate ml-2"
                  >
                    {inquiry.project.name}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-neutral-300 transition-colors"
            onClick={() => setLightboxPhoto(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxPhoto}
            alt="Foto"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Checklist Card ────────────────────────────────────────────────────────────

function ChecklistCard({
  checklistData,
  template,
}: {
  checklistData: Record<string, any> | null;
  template: InquiryTemplate | null;
}) {
  if (!checklistData || Object.keys(checklistData).length === 0) return null;

  // Build field map from template for labels and groups
  const fieldMap: Record<string, InquiryTemplateField> = {};
  if (template?.fields) {
    template.fields.forEach((f) => {
      fieldMap[f.key] = f;
    });
  }

  // Group entries
  const groups: Record<string, { key: string; label: string; value: any; type?: string }[]> = {};

  Object.entries(checklistData).forEach(([key, value]) => {
    // Skip internal keys like __photos
    if (key.startsWith("__")) return;

    const field = fieldMap[key];
    const group = field?.group || "Allgemein";
    const label = field?.label || key;
    const type = field?.type;

    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, label, value, type });
  });

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
        <Check className="w-5 h-5 text-[#fa432a]" />
        Checkliste
      </h2>
      <div className="space-y-4">
        {Object.entries(groups).map(([groupName, entries]) => (
          <div key={groupName}>
            {Object.keys(groups).length > 1 && (
              <h3 className="text-sm font-medium text-neutral-400 mb-2">
                {groupName}
              </h3>
            )}
            <div className="space-y-2">
              {entries.map(({ key, label, value, type }) => (
                <ChecklistEntry
                  key={key}
                  label={label}
                  value={value}
                  type={type}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Inline photos from checklist */}
      {checklistData.__photos && Array.isArray(checklistData.__photos) && checklistData.__photos.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#1a1a1a]">
          <p className="text-sm text-neutral-400 mb-2">Checklisten-Fotos</p>
          <div className="grid grid-cols-3 gap-2">
            {checklistData.__photos.map((photo: string, idx: number) => (
              <img
                key={idx}
                src={photo}
                alt={`Checkliste Foto ${idx + 1}`}
                className="w-full aspect-square object-cover rounded-lg"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistEntry({
  label,
  value,
  type,
}: {
  label: string;
  value: any;
  type?: string;
}) {
  // Render based on type
  if (type === "checkbox" || typeof value === "boolean") {
    return (
      <div className="flex items-center gap-3 text-sm">
        <div
          className={`w-5 h-5 rounded flex items-center justify-center ${
            value
              ? "bg-green-500/20 text-green-400"
              : "bg-neutral-800 text-neutral-600"
          }`}
        >
          {value && <Check className="w-3 h-3" />}
        </div>
        <span className={value ? "text-neutral-300" : "text-neutral-500"}>
          {label}
        </span>
      </div>
    );
  }

  if (type === "photo" && typeof value === "string" && value.startsWith("http")) {
    return (
      <div className="text-sm">
        <span className="text-neutral-500 block mb-1">{label}</span>
        <img
          src={value}
          alt={label}
          className="w-24 h-24 object-cover rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className="flex items-baseline justify-between text-sm gap-2">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-300 text-right">{String(value)}</span>
    </div>
  );
}

// ─── Direct Recipient View ─────────────────────────────────────────────────────

function DirectRecipientView({
  recipient,
  response,
  onAccept,
  onDeclineAll,
  actionLoading,
  isAnswered,
  isReadOnly,
}: {
  recipient: InquiryRecipient;
  response: InquiryResponse | undefined;
  onAccept: (partnerId: string) => void;
  onDeclineAll: () => void;
  actionLoading: boolean;
  isAnswered: boolean;
  isReadOnly: boolean;
}) {
  if (!recipient) return null;

  const recipientStatus = RECIPIENT_STATUS_MAP[recipient.status] || {
    label: recipient.status,
    class: "bg-neutral-500/20 text-neutral-400",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white font-medium">
            {recipient.partner?.company_name || "Partner"}
          </p>
          <span
            className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${recipientStatus.class}`}
          >
            {recipientStatus.label}
          </span>
        </div>
      </div>

      {response && response.status === "submitted" && (
        <ResponseDetails response={response} />
      )}

      {/* Action buttons */}
      {isAnswered && response && response.status === "submitted" && !isReadOnly && (
        <div className="flex gap-2 pt-2 border-t border-[#1a1a1a]">
          <button
            onClick={() => onAccept(recipient.partner_id)}
            disabled={actionLoading}
            className="btn-primary flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Akzeptieren
          </button>
          <button
            onClick={onDeclineAll}
            disabled={actionLoading}
            className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
            Ablehnen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tender Comparison View ─────────────────────────────────────────────────────

function TenderComparisonView({
  recipients,
  responses,
  expandedResponses,
  onToggleExpand,
  onAccept,
  onDeclineAll,
  actionLoading,
  isAnswered,
  isReadOnly,
}: {
  recipients: InquiryRecipient[];
  responses: InquiryResponse[];
  expandedResponses: Set<string>;
  onToggleExpand: (partnerId: string) => void;
  onAccept: (partnerId: string) => void;
  onDeclineAll: () => void;
  actionLoading: boolean;
  isAnswered: boolean;
  isReadOnly: boolean;
}) {
  function getResponse(partnerId: string): InquiryResponse | undefined {
    return responses.find((r) => r.partner_id === partnerId);
  }

  function getPrice(response: InquiryResponse | undefined): string {
    if (!response) return "–";
    if (response.response_type === "quick" && response.quick_price != null) {
      return formatCurrency(response.quick_price);
    }
    if (response.total_amount != null) {
      return formatCurrency(response.total_amount);
    }
    return "–";
  }

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-800 bg-[#0f0f0f]">
              <th className="text-left text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Partner
              </th>
              <th className="text-left text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Status
              </th>
              <th className="text-right text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Preis
              </th>
              <th className="text-left text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Zeitrahmen
              </th>
              <th className="text-left text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Gültigkeit
              </th>
              <th className="text-center text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                Details
              </th>
              {isAnswered && !isReadOnly && (
                <th className="text-right text-xs text-neutral-500 uppercase py-3 px-3 font-medium">
                  Aktion
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {recipients.map((rec) => {
              const response = getResponse(rec.partner_id);
              const recipientStatus = RECIPIENT_STATUS_MAP[rec.status] || {
                label: rec.status,
                class: "bg-neutral-500/20 text-neutral-400",
              };
              const isExpanded = expandedResponses.has(rec.partner_id);
              const hasDetailedPositions =
                response?.response_type === "detailed" &&
                response.positions?.length > 0;

              return (
                <tr key={rec.id}>
                  <td colSpan={isAnswered && !isReadOnly ? 7 : 6} className="p-0">
                    <table className="w-full">
                      <tbody>
                        <tr className="border-b border-neutral-800/50 hover:bg-[#111] transition-colors">
                          <td className="py-3 px-3">
                            <span className="text-white font-medium text-sm">
                              {rec.partner?.company_name || "–"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${recipientStatus.class}`}
                            >
                              {recipientStatus.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-white font-medium text-sm">
                              {getPrice(response)}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-neutral-300 text-sm">
                              {response?.quick_timeframe || "–"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-neutral-300 text-sm">
                              {response?.valid_until
                                ? formatDateShort(response.valid_until)
                                : "–"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {hasDetailedPositions && (
                              <button
                                onClick={() => onToggleExpand(rec.partner_id)}
                                className="text-neutral-400 hover:text-white transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </td>
                          {isAnswered && !isReadOnly && (
                            <td className="py-3 px-3 text-right">
                              {rec.status === "responded" && (
                                <button
                                  onClick={() => onAccept(rec.partner_id)}
                                  disabled={actionLoading}
                                  className="btn-primary text-xs px-3 py-1.5"
                                >
                                  Akzeptieren
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                        {/* Expanded positions */}
                        {isExpanded && hasDetailedPositions && (
                          <tr>
                            <td colSpan={isAnswered && !isReadOnly ? 7 : 6}>
                              <div className="px-3 py-3 bg-[#0a0a0a]">
                                <ResponseDetails response={response!} compact />
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {recipients.map((rec) => {
          const response = getResponse(rec.partner_id);
          const recipientStatus = RECIPIENT_STATUS_MAP[rec.status] || {
            label: rec.status,
            class: "bg-neutral-500/20 text-neutral-400",
          };
          const isExpanded = expandedResponses.has(rec.partner_id);
          const hasDetailedPositions =
            response?.response_type === "detailed" &&
            response.positions?.length > 0;

          return (
            <div key={rec.id} className="bg-[#111] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium text-sm">
                  {rec.partner?.company_name || "–"}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${recipientStatus.class}`}
                >
                  {recipientStatus.label}
                </span>
              </div>
              {response && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Preis</span>
                    <span className="text-white font-medium">
                      {getPrice(response)}
                    </span>
                  </div>
                  {response.quick_timeframe && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Zeitrahmen</span>
                      <span className="text-neutral-300">
                        {response.quick_timeframe}
                      </span>
                    </div>
                  )}
                  {response.valid_until && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-500">Gültig bis</span>
                      <span className="text-neutral-300">
                        {formatDateShort(response.valid_until)}
                      </span>
                    </div>
                  )}
                  {hasDetailedPositions && (
                    <button
                      onClick={() => onToggleExpand(rec.partner_id)}
                      className="text-sm text-[#fa432a] flex items-center gap-1"
                    >
                      {isExpanded ? "Weniger" : "Details"}
                      {isExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                  {isExpanded && hasDetailedPositions && (
                    <div className="pt-2 border-t border-[#1a1a1a]">
                      <ResponseDetails response={response} compact />
                    </div>
                  )}
                </>
              )}
              {isAnswered && !isReadOnly && rec.status === "responded" && (
                <div className="pt-2 border-t border-[#1a1a1a]">
                  <button
                    onClick={() => onAccept(rec.partner_id)}
                    disabled={actionLoading}
                    className="btn-primary w-full text-sm"
                  >
                    Akzeptieren
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decline all button */}
      {isAnswered && !isReadOnly && (
        <div className="pt-2">
          <button
            onClick={onDeclineAll}
            disabled={actionLoading}
            className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <XCircle className="w-4 h-4" />
            Alle ablehnen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Response Details ───────────────────────────────────────────────────────────

function ResponseDetails({
  response,
  compact = false,
}: {
  response: InquiryResponse;
  compact?: boolean;
}) {
  if (response.response_type === "quick") {
    return (
      <div className="space-y-2">
        {response.quick_text && (
          <p className="text-neutral-300 text-sm whitespace-pre-wrap">
            {response.quick_text}
          </p>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          {response.quick_price != null && (
            <div>
              <span className="text-neutral-500">Preis: </span>
              <span className="text-white font-medium">
                {formatCurrency(response.quick_price)}
              </span>
            </div>
          )}
          {response.quick_timeframe && (
            <div>
              <span className="text-neutral-500">Zeitrahmen: </span>
              <span className="text-neutral-300">
                {response.quick_timeframe}
              </span>
            </div>
          )}
          {response.valid_until && (
            <div>
              <span className="text-neutral-500">Gültig bis: </span>
              <span className="text-neutral-300">
                {formatDateShort(response.valid_until)}
              </span>
            </div>
          )}
        </div>
        {response.notes && (
          <p className="text-neutral-400 text-sm mt-2">{response.notes}</p>
        )}
      </div>
    );
  }

  // Detailed response with positions
  return (
    <div className="space-y-3">
      {response.positions && response.positions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0f0f0f]">
                <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                  Beschreibung
                </th>
                {!compact && (
                  <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                    Menge
                  </th>
                )}
                {!compact && (
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                    Einheit
                  </th>
                )}
                <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                  EP
                </th>
                <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                  Gesamt
                </th>
                {!compact && (
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                    Kategorie
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {response.positions.map((pos, idx) => (
                <tr
                  key={idx}
                  className="border-b border-neutral-800/50"
                >
                  <td className="py-2 px-2 text-neutral-300">
                    {pos.description}
                  </td>
                  {!compact && (
                    <td className="py-2 px-2 text-right text-neutral-300">
                      {pos.quantity}
                    </td>
                  )}
                  {!compact && (
                    <td className="py-2 px-2 text-neutral-400">{pos.unit}</td>
                  )}
                  <td className="py-2 px-2 text-right text-neutral-300">
                    {formatCurrency(pos.unit_price)}
                  </td>
                  <td className="py-2 px-2 text-right text-white font-medium">
                    {formatCurrency(pos.total)}
                  </td>
                  {!compact && (
                    <td className="py-2 px-2">
                      <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                        {POSITION_CATEGORIES[pos.category] || pos.category}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-700">
                <td
                  colSpan={compact ? 2 : 4}
                  className="py-2 px-2 text-right text-neutral-400 font-medium"
                >
                  Gesamtbetrag
                </td>
                <td className="py-2 px-2 text-right text-white font-bold">
                  {response.total_amount != null
                    ? formatCurrency(response.total_amount)
                    : "–"}
                </td>
                {!compact && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {response.notes && (
        <div>
          <span className="text-neutral-500 text-xs">Anmerkungen:</span>
          <p className="text-neutral-300 text-sm mt-1">{response.notes}</p>
        </div>
      )}

      {response.valid_until && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Clock className="w-3 h-3" />
          Gültig bis: {formatDateShort(response.valid_until)}
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: InquiryMessage }) {
  const isStaff = message.sender_type === "staff";

  return (
    <div className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isStaff
            ? "bg-[#fa432a]/10 border border-[#fa432a]/20"
            : "bg-[#1a1a1a] border border-[#222]"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-white">
            {message.sender_name}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isStaff
                ? "bg-[#fa432a]/20 text-[#fa432a]"
                : "bg-neutral-700 text-neutral-400"
            }`}
          >
            {isStaff ? "Staff" : "Partner"}
          </span>
          <span className="text-[10px] text-neutral-600">
            {formatDateTime(message.created_at)}
          </span>
        </div>
        <p className="text-sm text-neutral-300 whitespace-pre-wrap">
          {message.message}
        </p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.attachments.map((att, idx) => (
              <a
                key={idx}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-[#fa432a] hover:underline"
              >
                <Paperclip className="w-3 h-3" />
                {att.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Action Sidebar ─────────────────────────────────────────────────────────────

function ActionSidebar({
  inquiry,
  actionLoading,
  onDeclineAll,
  onClose,
  hasResponses,
}: {
  inquiry: InquiryDetail;
  actionLoading: boolean;
  onDeclineAll: () => void;
  onClose: () => void;
  hasResponses: boolean;
}) {
  const status = inquiry.status;

  // No actions for read-only states
  if (["declined", "closed"].includes(status)) {
    return (
      <div className="card p-5">
        <h2 className="font-semibold text-white mb-3">Aktionen</h2>
        <p className="text-neutral-500 text-sm">
          Diese Anfrage ist {status === "closed" ? "abgeschlossen" : "abgelehnt"}.
          Keine weiteren Aktionen möglich.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold text-white mb-3">Aktionen</h2>
      <div className="space-y-2">
        {/* Draft actions */}
        {status === "draft" && (
          <>
            <Link
              href={`/anfragen/neu?edit=${inquiry.id}`}
              className="btn-secondary w-full text-center"
            >
              Bearbeiten
            </Link>
          </>
        )}

        {/* Answered actions */}
        {status === "answered" && (
          <>
            <button
              onClick={onDeclineAll}
              disabled={actionLoading}
              className="btn-secondary w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300"
            >
              <XCircle className="w-4 h-4" />
              Alle ablehnen
            </button>
            <Link
              href={`/angebote?inquiry_id=${inquiry.id}`}
              className="btn-secondary w-full text-center"
            >
              Ins Angebot übernehmen
            </Link>
          </>
        )}

        {/* Accepted actions */}
        {status === "accepted" && (
          <>
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="btn-primary w-full"
            >
              Abschließen
            </button>
            <Link
              href={`/angebote?inquiry_id=${inquiry.id}`}
              className="btn-secondary w-full text-center"
            >
              Ins Angebot übernehmen
            </Link>
          </>
        )}

        {/* Sent / In Review - no special actions */}
        {(status === "sent" || status === "in_review") && (
          <p className="text-neutral-500 text-sm">
            Warten auf Antworten der Partner.
          </p>
        )}
      </div>
    </div>
  );
}
