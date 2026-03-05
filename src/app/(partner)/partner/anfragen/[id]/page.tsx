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
  Check,
  Clock,
  X,
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  FolderOpen,
} from "lucide-react";
import {
  URGENCY_MAP,
  POSITION_CATEGORIES,
} from "@/lib/inquiries/constants";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import { toast } from "sonner";
import type {
  Inquiry,
  InquiryResponse,
  InquiryMessage,
  InquiryTemplate,
  InquiryTemplateField,
  ResponsePosition,
  ResponseType,
} from "@/lib/inquiries/types";

// Extended Inquiry with joined data from the partner API
interface PartnerInquiryDetail extends Inquiry {
  messages?: InquiryMessage[];
  own_response?: InquiryResponse | null;
}

// Empty position template
const emptyPosition: ResponsePosition = {
  description: "",
  quantity: 1,
  unit: "Stück",
  unit_price: 0,
  total: 0,
  category: "labor",
};

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

function getDefaultValidUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export default function PartnerInquiryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const inquiryId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [inquiry, setInquiry] = useState<PartnerInquiryDetail | null>(null);
  const [template, setTemplate] = useState<InquiryTemplate | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);

  // Response form state
  const [responseTab, setResponseTab] = useState<ResponseType>("quick");
  const [quickText, setQuickText] = useState("");
  const [quickPrice, setQuickPrice] = useState<number | "">("");
  const [quickTimeframe, setQuickTimeframe] = useState("");
  const [positions, setPositions] = useState<ResponsePosition[]>([{ ...emptyPosition }]);
  const [validUntil, setValidUntil] = useState(getDefaultValidUntil());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Messages state
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Photo lightbox
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    loadData();
    markViewed();
  }, [inquiryId]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel(`partner-inquiry-${inquiryId}`)
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

  async function markViewed() {
    try {
      await fetch("/api/partner/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_viewed", id: inquiryId }),
      });
    } catch {
      // Ignore errors for mark_viewed
    }
  }

  async function loadData() {
    try {
      await loadTradesFromDB(supabase, true);

      const res = await fetch("/api/partner/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", id: inquiryId }),
      });

      const result = await res.json();

      if (!res.ok || !result.data) {
        toast.error("Anfrage nicht gefunden");
        router.push("/partner/anfragen");
        return;
      }

      const inq = result.data as PartnerInquiryDetail;
      setInquiry(inq);
      setMessages(inq.messages || []);

      // Load template if template_id exists
      if (inq.template_id) {
        const { data: tmpl } = await supabase
          .from("inquiry_templates")
          .select("*")
          .eq("id", inq.template_id)
          .single();

        if (tmpl) setTemplate(tmpl as InquiryTemplate);
      }

      // Populate form from existing draft response
      if (inq.own_response) {
        const resp = inq.own_response;
        if (resp.status === "submitted") {
          setIsSubmitted(true);
        }
        setResponseTab(resp.response_type || "quick");
        setQuickText(resp.quick_text || "");
        setQuickPrice(resp.quick_price ?? "");
        setQuickTimeframe(resp.quick_timeframe || "");
        setNotes(resp.notes || "");
        setValidUntil(resp.valid_until || getDefaultValidUntil());
        if (resp.positions && resp.positions.length > 0) {
          setPositions(resp.positions);
        }
      }
    } catch (err) {
      console.error("Error loading inquiry:", err);
      toast.error("Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  // Position helpers
  function updatePosition(index: number, field: keyof ResponsePosition, value: any) {
    setPositions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total
      updated[index].total = updated[index].quantity * updated[index].unit_price;
      return updated;
    });
  }

  function addPosition() {
    setPositions((prev) => [...prev, { ...emptyPosition }]);
  }

  function removePosition(index: number) {
    setPositions((prev) => prev.filter((_, i) => i !== index));
  }

  function getGrandTotal(): number {
    return positions.reduce((sum, p) => sum + (p.quantity * p.unit_price), 0);
  }

  async function submitResponse(status: "draft" | "submitted") {
    if (!inquiry) return;

    // Validation
    if (status === "submitted") {
      if (responseTab === "quick") {
        if (!quickText.trim() && (quickPrice === "" || quickPrice === 0)) {
          toast.error("Bitte geben Sie mindestens eine Einschätzung oder einen Preis an.");
          return;
        }
      } else {
        const validPositions = positions.filter((p) => p.description.trim());
        if (validPositions.length === 0) {
          toast.error("Bitte fügen Sie mindestens eine Position hinzu.");
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        action: "respond",
        id: inquiry.id,
        response_type: responseTab,
        status,
        notes: notes || null,
        valid_until: validUntil || null,
      };

      if (responseTab === "quick") {
        payload.quick_text = quickText || null;
        payload.quick_price = quickPrice === "" ? null : Number(quickPrice);
        payload.quick_timeframe = quickTimeframe || null;
        payload.total_amount = quickPrice === "" ? null : Number(quickPrice);
      } else {
        const validPositions = positions
          .filter((p) => p.description.trim())
          .map((p) => ({
            ...p,
            total: p.quantity * p.unit_price,
          }));
        payload.positions = validPositions;
        payload.total_amount = validPositions.reduce((s, p) => s + p.total, 0);
      }

      const res = await fetch("/api/partner/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Fehler beim Speichern");
      } else {
        if (status === "submitted") {
          toast.success("Antwort erfolgreich gesendet!");
          setIsSubmitted(true);
        } else {
          toast.success("Entwurf gespeichert");
        }
        loadData();
      }
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage() {
    if (!inquiry || !messageText.trim()) return;

    setSendingMessage(true);
    try {
      const res = await fetch("/api/partner/inquiries", {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!inquiry) return null;

  const urgencyInfo = URGENCY_MAP[inquiry.urgency] || {
    label: inquiry.urgency,
    class: "bg-neutral-500/20 text-neutral-400",
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Back link */}
      <Link
        href="/partner/anfragen"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Liste
      </Link>

      {/* 1. Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{inquiry.title}</h1>
          <span className={`text-xs px-2 py-1 rounded ${urgencyInfo.class}`}>
            {urgencyInfo.label}
          </span>
          {isSubmitted && (
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
              Gesendet
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-neutral-400">
          <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
            {getTradeLabel(inquiry.trade)}
          </span>
          <span>Erhalten: {formatDateShort(inquiry.created_at)}</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Inquiry Details Card */}
          {(inquiry.description || inquiry.location_notes || inquiry.project) && (
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
                <div className="flex items-center gap-2 text-sm text-neutral-400">
                  <FolderOpen className="w-4 h-4 text-neutral-500" />
                  <span>Projekt: {inquiry.project.name}</span>
                </div>
              )}
            </div>
          )}

          {/* 3. Checklist Card (read-only) */}
          <ChecklistCard
            checklistData={inquiry.checklist_data}
            template={template}
          />

          {/* 4. Photos Gallery (read-only) */}
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

          {/* 5. Response Form */}
          <ResponseFormSection
            isSubmitted={isSubmitted}
            ownResponse={inquiry.own_response || null}
            responseTab={responseTab}
            setResponseTab={setResponseTab}
            quickText={quickText}
            setQuickText={setQuickText}
            quickPrice={quickPrice}
            setQuickPrice={setQuickPrice}
            quickTimeframe={quickTimeframe}
            setQuickTimeframe={setQuickTimeframe}
            positions={positions}
            updatePosition={updatePosition}
            addPosition={addPosition}
            removePosition={removePosition}
            getGrandTotal={getGrandTotal}
            validUntil={validUntil}
            setValidUntil={setValidUntil}
            notes={notes}
            setNotes={setNotes}
            submitting={submitting}
            onSubmit={submitResponse}
          />

          {/* 6. Messages Section */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#fa432a]" />
              Nachrichten
            </h2>

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
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3">Info</h2>
            <div className="space-y-3 text-sm">
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
                <span className="text-neutral-500">Erhalten</span>
                <span className="text-neutral-300">
                  {formatDateShort(inquiry.created_at)}
                </span>
              </div>
              {inquiry.project && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Projekt</span>
                  <span className="text-neutral-300 text-right truncate ml-2">
                    {inquiry.project.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Modus</span>
                <span className="text-neutral-300">
                  {inquiry.mode === "direct" ? "Direkt" : "Ausschreibung"}
                </span>
              </div>
            </div>
          </div>

          {/* Response Status Card */}
          {inquiry.own_response && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Ihre Antwort</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Status</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      inquiry.own_response.status === "submitted"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {inquiry.own_response.status === "submitted" ? "Gesendet" : "Entwurf"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Typ</span>
                  <span className="text-neutral-300">
                    {inquiry.own_response.response_type === "quick" ? "Schnellantwort" : "Kalkulation"}
                  </span>
                </div>
                {inquiry.own_response.total_amount != null && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Betrag</span>
                    <span className="text-white font-medium">
                      {formatCurrency(inquiry.own_response.total_amount)}
                    </span>
                  </div>
                )}
                {inquiry.own_response.valid_until && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Gültig bis</span>
                    <span className="text-neutral-300">
                      {formatDateShort(inquiry.own_response.valid_until)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Lightbox */}
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

// ---- Checklist Card (read-only) ----

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

// ---- Response Form Section ----

function ResponseFormSection({
  isSubmitted,
  ownResponse,
  responseTab,
  setResponseTab,
  quickText,
  setQuickText,
  quickPrice,
  setQuickPrice,
  quickTimeframe,
  setQuickTimeframe,
  positions,
  updatePosition,
  addPosition,
  removePosition,
  getGrandTotal,
  validUntil,
  setValidUntil,
  notes,
  setNotes,
  submitting,
  onSubmit,
}: {
  isSubmitted: boolean;
  ownResponse: InquiryResponse | null;
  responseTab: ResponseType;
  setResponseTab: (tab: ResponseType) => void;
  quickText: string;
  setQuickText: (v: string) => void;
  quickPrice: number | "";
  setQuickPrice: (v: number | "") => void;
  quickTimeframe: string;
  setQuickTimeframe: (v: string) => void;
  positions: ResponsePosition[];
  updatePosition: (i: number, field: keyof ResponsePosition, value: any) => void;
  addPosition: () => void;
  removePosition: (i: number) => void;
  getGrandTotal: () => number;
  validUntil: string;
  setValidUntil: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  onSubmit: (status: "draft" | "submitted") => void;
}) {
  // If already submitted, show read-only view
  if (isSubmitted && ownResponse && ownResponse.status === "submitted") {
    return (
      <div className="bg-[#111] rounded-xl border border-[#222] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white text-lg">Ihre Antwort</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
            Gesendet
          </span>
        </div>

        {ownResponse.response_type === "quick" ? (
          <div className="space-y-3">
            {ownResponse.quick_text && (
              <div>
                <span className="text-xs text-neutral-500 block mb-1">Einschätzung</span>
                <p className="text-neutral-300 text-sm whitespace-pre-wrap">
                  {ownResponse.quick_text}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              {ownResponse.quick_price != null && (
                <div>
                  <span className="text-neutral-500">Preis: </span>
                  <span className="text-white font-medium">
                    {formatCurrency(ownResponse.quick_price)}
                  </span>
                </div>
              )}
              {ownResponse.quick_timeframe && (
                <div>
                  <span className="text-neutral-500">Zeitrahmen: </span>
                  <span className="text-neutral-300">{ownResponse.quick_timeframe}</span>
                </div>
              )}
              {ownResponse.valid_until && (
                <div>
                  <span className="text-neutral-500">Gültig bis: </span>
                  <span className="text-neutral-300">
                    {formatDateShort(ownResponse.valid_until)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {ownResponse.positions && ownResponse.positions.length > 0 && (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                        <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          Beschreibung
                        </th>
                        <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          Menge
                        </th>
                        <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          Einheit
                        </th>
                        <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          EP
                        </th>
                        <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          Gesamt
                        </th>
                        <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                          Kategorie
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownResponse.positions.map((pos, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-neutral-800/50"
                        >
                          <td className="py-2 px-2 text-neutral-300">{pos.description}</td>
                          <td className="py-2 px-2 text-right text-neutral-300">{pos.quantity}</td>
                          <td className="py-2 px-2 text-neutral-400">{pos.unit}</td>
                          <td className="py-2 px-2 text-right text-neutral-300">
                            {formatCurrency(pos.unit_price)}
                          </td>
                          <td className="py-2 px-2 text-right text-white font-medium">
                            {formatCurrency(pos.total)}
                          </td>
                          <td className="py-2 px-2">
                            <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                              {POSITION_CATEGORIES[pos.category] || pos.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-neutral-700">
                        <td colSpan={4} className="py-2 px-2 text-right text-neutral-400 font-medium">
                          Gesamtbetrag
                        </td>
                        <td className="py-2 px-2 text-right text-white font-bold text-base">
                          {ownResponse.total_amount != null
                            ? formatCurrency(ownResponse.total_amount)
                            : "--"}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {ownResponse.positions.map((pos, idx) => (
                    <div key={idx} className="bg-[#0a0a0a] rounded-lg p-3 space-y-1 text-sm">
                      <p className="text-white font-medium">{pos.description}</p>
                      <div className="flex justify-between text-neutral-400">
                        <span>{pos.quantity} {pos.unit}</span>
                        <span>{formatCurrency(pos.unit_price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                          {POSITION_CATEGORIES[pos.category] || pos.category}
                        </span>
                        <span className="text-white font-medium">{formatCurrency(pos.total)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-neutral-700">
                    <span className="text-neutral-400 font-medium">Gesamtbetrag</span>
                    <span className="text-white font-bold text-lg">
                      {ownResponse.total_amount != null
                        ? formatCurrency(ownResponse.total_amount)
                        : "--"}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {ownResponse.notes && (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
            <span className="text-xs text-neutral-500">Anmerkungen:</span>
            <p className="text-neutral-300 text-sm mt-1">{ownResponse.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // Editable form
  return (
    <div className="bg-[#111] rounded-xl border border-[#222] p-5">
      <h2 className="font-semibold text-white text-lg mb-4">Antwort erstellen</h2>

      {/* Tab toggle */}
      <div className="flex bg-[#0a0a0a] rounded-lg p-1 mb-6">
        <button
          onClick={() => setResponseTab("quick")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            responseTab === "quick"
              ? "bg-[#fa432a] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Schnellantwort
        </button>
        <button
          onClick={() => setResponseTab("detailed")}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            responseTab === "detailed"
              ? "bg-[#fa432a] text-white"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Detaillierte Kalkulation
        </button>
      </div>

      {/* Quick response tab */}
      {responseTab === "quick" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-neutral-400 block mb-1.5">Ihre Einschätzung</label>
            <textarea
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Beschreiben Sie was gemacht werden muss und Ihren Preisvorschlag..."
              rows={4}
              className="input w-full resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-neutral-400 block mb-1.5">Preis</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickPrice}
                  onChange={(e) =>
                    setQuickPrice(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0,00"
                  className="input w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm pointer-events-none">
                  EUR
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm text-neutral-400 block mb-1.5">Zeitrahmen</label>
              <input
                type="text"
                value={quickTimeframe}
                onChange={(e) => setQuickTimeframe(e.target.value)}
                placeholder="z.B. 2-3 Werktage"
                className="input w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Detailed calculation tab */}
      {responseTab === "detailed" && (
        <div className="space-y-4">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium">
                    Beschreibung
                  </th>
                  <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium w-20">
                    Menge
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium w-24">
                    Einheit
                  </th>
                  <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium w-28">
                    Einzelpreis
                  </th>
                  <th className="text-right text-xs text-neutral-500 uppercase py-2 px-2 font-medium w-28">
                    Gesamt
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-2 px-2 font-medium w-32">
                    Kategorie
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-neutral-800/50 ${
                      idx % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#111]"
                    }`}
                  >
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={pos.description}
                        onChange={(e) => updatePosition(idx, "description", e.target.value)}
                        placeholder="Beschreibung..."
                        className="input w-full text-sm py-1.5"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pos.quantity}
                        onChange={(e) => updatePosition(idx, "quantity", Number(e.target.value))}
                        className="input w-full text-sm py-1.5 text-right"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={pos.unit}
                        onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                        placeholder="Stück"
                        className="input w-full text-sm py-1.5"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={pos.unit_price}
                        onChange={(e) => updatePosition(idx, "unit_price", Number(e.target.value))}
                        className="input w-full text-sm py-1.5 text-right"
                      />
                    </td>
                    <td className="py-2 px-2 text-right text-white font-medium text-sm">
                      {formatCurrency(pos.quantity * pos.unit_price)}
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={pos.category}
                        onChange={(e) => updatePosition(idx, "category", e.target.value)}
                        className="input w-full text-sm py-1.5"
                      >
                        {Object.entries(POSITION_CATEGORIES).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      {positions.length > 1 && (
                        <button
                          onClick={() => removePosition(idx)}
                          className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800 transition-colors"
                          title="Position entfernen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-700">
                  <td colSpan={4} className="py-3 px-2 text-right text-neutral-400 font-semibold">
                    Gesamtbetrag
                  </td>
                  <td className="py-3 px-2 text-right text-white font-bold text-lg">
                    {formatCurrency(getGrandTotal())}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {positions.map((pos, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-4 space-y-3 ${
                  idx % 2 === 0 ? "bg-[#0f0f0f]" : "bg-[#0a0a0a]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500 font-medium">
                    Position {idx + 1}
                  </span>
                  {positions.length > 1 && (
                    <button
                      onClick={() => removePosition(idx)}
                      className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Beschreibung</label>
                  <input
                    type="text"
                    value={pos.description}
                    onChange={(e) => updatePosition(idx, "description", e.target.value)}
                    placeholder="Beschreibung..."
                    className="input w-full text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Menge</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pos.quantity}
                      onChange={(e) => updatePosition(idx, "quantity", Number(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Einheit</label>
                    <input
                      type="text"
                      value={pos.unit}
                      onChange={(e) => updatePosition(idx, "unit", e.target.value)}
                      placeholder="Stück"
                      className="input w-full text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Einzelpreis</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pos.unit_price}
                      onChange={(e) => updatePosition(idx, "unit_price", Number(e.target.value))}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 block mb-1">Kategorie</label>
                    <select
                      value={pos.category}
                      onChange={(e) => updatePosition(idx, "category", e.target.value)}
                      className="input w-full text-sm"
                    >
                      {Object.entries(POSITION_CATEGORIES).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end text-sm">
                  <span className="text-neutral-500 mr-2">Gesamt:</span>
                  <span className="text-white font-medium">
                    {formatCurrency(pos.quantity * pos.unit_price)}
                  </span>
                </div>
              </div>
            ))}

            {/* Mobile grand total */}
            <div className="flex justify-between items-center p-4 bg-[#fa432a]/10 border border-[#fa432a]/20 rounded-lg">
              <span className="text-neutral-300 font-semibold">Gesamtbetrag</span>
              <span className="text-white font-bold text-xl">
                {formatCurrency(getGrandTotal())}
              </span>
            </div>
          </div>

          {/* Add position button */}
          <button
            onClick={addPosition}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Position hinzufügen
          </button>
        </div>
      )}

      {/* Common fields */}
      <div className="mt-6 pt-6 border-t border-[#1a1a1a] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-neutral-400 block mb-1.5">Gültig bis</label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input w-full"
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-neutral-400 block mb-1.5">
            Zusätzliche Hinweise{" "}
            <span className="text-neutral-600">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Weitere Anmerkungen oder Bedingungen..."
            rows={3}
            className="input w-full resize-none"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-6 border-t border-[#1a1a1a]">
        <button
          onClick={() => onSubmit("draft")}
          disabled={submitting}
          className="btn-secondary flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Als Entwurf speichern
        </button>
        <button
          onClick={() => onSubmit("submitted")}
          disabled={submitting}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" />
          Antwort absenden
        </button>
      </div>
    </div>
  );
}

// ---- Message Bubble ----

function MessageBubble({ message }: { message: InquiryMessage }) {
  // In the partner context, partner messages are "own" messages (right side)
  const isPartner = message.sender_type === "partner";

  return (
    <div className={`flex ${isPartner ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-4 py-3 ${
          isPartner
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
              isPartner
                ? "bg-[#fa432a]/20 text-[#fa432a]"
                : "bg-neutral-700 text-neutral-400"
            }`}
          >
            {isPartner ? "Sie" : "Staff"}
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
