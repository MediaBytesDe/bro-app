"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { ChevronLeft, RefreshCw, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatValue, formatDate } from "@/lib/utils";
import type { Lead } from "@/types/database";

const statusOptions = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;

const statusLabels: Record<string, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  proposal: "Angebot",
  negotiation: "Verhandlung",
  won: "Gewonnen",
  lost: "Verloren",
};

const statusColors: Record<string, string> = {
  new: "badge-info",
  contacted: "badge-warning",
  qualified: "badge-purple",
  proposal: "badge-orange",
  negotiation: "badge-info",
  won: "badge-success",
  lost: "badge-error",
};

interface Props {
  leadId: string;
}

export function LeadDetail({ leadId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertForm, setConvertForm] = useState({
    customer_type: "private" as "private" | "business" | "public",
    street: "",
    zip: "",
    city: "",
    customer_number: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadLead();
    // Safety timeout: force loading off if query hangs
    const timeout = setTimeout(() => {
      setLoading((v) => {
        if (v) console.warn("Lead detail safety timeout: forcing loading to false");
        return false;
      });
    }, 10000);
    return () => clearTimeout(timeout);
  }, [leadId]);

  async function loadLead() {
    setLoading(true);
    try {
      const { data } = await supabase.from("leads").select("*").eq("id", leadId).single();
      setLead(data);
    } catch (err) {
      console.error("Lead load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveLead() {
    if (!lead) return;
    setSaving(true);
    await supabase
      .from("leads")
      .update({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        source: lead.source,
        status: lead.status,
        notes: lead.notes,
        assigned_to: lead.assigned_to,
        value: lead.value,
        email_subject: lead.email_subject,
        email_draft: lead.email_draft,
        email_status: lead.email_status,
      })
      .eq("id", leadId);
    setSaving(false);
  }

  async function generateEmail() {
    if (!lead) return;
    setGenerating(true);

    let ansprechpartner = "";
    let anrede = "Sehr geehrte Damen und Herren";

    if (lead.notes) {
      const apMatch = lead.notes.match(/Ansprechpartner(?:in)?:\s*([^\n\(]+)/i);
      if (apMatch) {
        ansprechpartner = apMatch[1].trim();
        if (lead.notes.toLowerCase().includes("ansprechpartnerin")) {
          anrede = `Sehr geehrte Frau ${ansprechpartner.split(" ").pop()}`;
        } else {
          anrede = `Sehr geehrter Herr ${ansprechpartner.split(" ").pop()}`;
        }
      }
    }

    if (anrede === "Sehr geehrte Damen und Herren" && lead.name && !lead.name.includes("GmbH") && !lead.name.includes("Projekt")) {
      anrede = `Sehr geehrte/r ${lead.name}`;
    }

    let projektDetails = "";
    if (lead.notes) {
      const zahlenMatch = lead.notes.match(/(\d+\.?\d*)\s*(Bauplätze|Wohneinheiten|Hektar|Häuser|Einheiten)/i);
      if (zahlenMatch) {
        projektDetails = `${zahlenMatch[1]} ${zahlenMatch[2]}`;
      }
    }

    const firmenName = lead.company || lead.name || "Ihr Unternehmen";
    const projektName = lead.company || "Ihr Projekt";

    const subject = `Photovoltaik-Partnerschaft für ${projektName} – Sofort.Solar`;

    const emailText = `${anrede},

mit großem Interesse habe ich von ${projektName}${projektDetails ? ` mit ${projektDetails}` : ""} erfahren. Als regionales Unternehmen aus Ostfriesland möchten wir Ihnen eine Zusammenarbeit anbieten, von der beide Seiten profitieren.

**Sofort.Solar** – eine Marke der BROjekt GmbH – hat sich auf schlüsselfertige Photovoltaik-Lösungen für Neubauprojekte spezialisiert. Wir bieten Ihnen und Ihren Bauherren:

✓ **Kostenlose PV-Beratung** für jeden Bauinteressenten
✓ **Individuelle Anlagenplanung** mit modernster 3D-Software
✓ **Festpreisangebote** – transparent und verbindlich
✓ **Komplettservice** von der Planung bis zur Inbetriebnahme
✓ **Regionale Fachbetriebe** für Installation und Wartung

Für ${firmenName} bedeutet das: Sie können Ihren Kunden einen echten Mehrwert bieten – ohne eigenen Aufwand. Wir übernehmen die komplette Abwicklung und Sie profitieren von zufriedenen Käufern, die ihr Eigenheim von Anfang an nachhaltig gestalten.

Darf ich Sie in den nächsten Tagen kurz anrufen, um die Möglichkeiten einer Zusammenarbeit zu besprechen? Alternativ können Sie mich auch gerne direkt kontaktieren.

Mit freundlichen Grüßen

**André Freese**
Sofort.Solar – Eine Marke der BROjekt GmbH

Tel: 04971 / 923 50 50
E-Mail: a.freese@brojekt.gmbh
Web: www.sofort.solar`;

    setLead({
      ...lead,
      email_subject: subject,
      email_draft: emailText,
      email_status: "draft",
    });

    setGenerating(false);
    
    // Auto-save after generating
    await supabase
      .from("leads")
      .update({
        email_subject: subject,
        email_draft: emailText,
        email_status: "draft",
      })
      .eq("id", leadId);
  }

  function setEmailStatus(status: string) {
    if (!lead) return;
    setLead({ ...lead, email_status: status });
    supabase.from("leads").update({ email_status: status }).eq("id", leadId);
  }

  async function convertToCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    
    setConverting(true);
    
    try {
      // 1. Create customer from lead data
      const customerData = {
        customer_type: convertForm.customer_type,
        customer_number: convertForm.customer_number || null,
        company_name: lead.company || null,
        first_name: lead.name?.split(" ")[0] || null,
        last_name: lead.name?.split(" ").slice(1).join(" ") || lead.name || "",
        email: lead.email,
        phone: lead.phone,
        street: convertForm.street || null,
        zip: convertForm.zip || null,
        city: convertForm.city || null,
        status: "active",
        notes: lead.notes,
        lead_id: lead.id,
      };

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert(customerData)
        .select("id")
        .single();

      if (customerError) throw customerError;

      // 2. Update lead status to "won" and link to customer
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          status: "won",
          customer_id: customer.id,
        })
        .eq("id", leadId);

      if (leadError) throw leadError;

      // 3. Success! Navigate to customer
      setShowConvert(false);
      router.push(`/customers/${customer.id}`);
    } catch (err) {
      console.error("Conversion error:", err);
      alert("Fehler bei der Konvertierung. Bitte versuche es erneut.");
    } finally {
      setConverting(false);
    }
  }

  function openConvertModal() {
    if (!lead) return;
    // Pre-fill form with lead data
    setConvertForm({
      customer_type: lead.company ? "business" : "private",
      street: "",
      zip: "",
      city: "",
      customer_number: "",
    });
    setShowConvert(true);
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Spinner className="mx-auto" />
        <p className="text-neutral-500 mt-4">Lade Lead...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-12 text-center text-neutral-500">
        <span className="text-4xl mb-4 block">❌</span>
        Lead nicht gefunden
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.push("/leads")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Zurück zur Liste
        </button>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusColors[lead.status || "new"]}`}>{statusLabels[lead.status || "new"]}</span>
          <span className="text-green-400 font-bold text-lg">{formatValue(lead.value) || "-"}</span>
          {lead.status !== "lost" && !lead.customer_id && (
            <button onClick={openConvertModal} className="btn btn-primary">
              <UserPlus className="w-4 h-4" />
              Zu Kunde konvertieren
            </button>
          )}
          {lead.customer_id && (
            <button 
              onClick={() => router.push(`/customers/${lead.customer_id}`)} 
              className="btn btn-secondary"
            >
              Kunde anzeigen →
            </button>
          )}
        </div>
      </div>

      {/* Lead Info Card */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold mb-6 text-white">{lead.name}</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="form-label">Firma</label>
              <input
                value={lead.company || ""}
                onChange={(e) => setLead({ ...lead, company: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                value={lead.email || ""}
                onChange={(e) => setLead({ ...lead, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Telefon</label>
              <input
                value={lead.phone || ""}
                onChange={(e) => setLead({ ...lead, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="form-label">Status</label>
              <select
                value={lead.status || "new"}
                onChange={(e) => setLead({ ...lead, status: e.target.value as Lead["status"] })}
                className="input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Quelle</label>
              <input
                value={lead.source || ""}
                onChange={(e) => setLead({ ...lead, source: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Wert (€)</label>
              <input
                type="number"
                value={lead.value || ""}
                onChange={(e) => setLead({ ...lead, value: e.target.value ? parseFloat(e.target.value) : null })}
                className="input"
              />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="form-label">Notizen</label>
          <textarea
            value={lead.notes || ""}
            onChange={(e) => setLead({ ...lead, notes: e.target.value })}
            rows={3}
            className="input"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={saveLead} disabled={saving} className="btn btn-primary">
            {saving && <Spinner className="!w-5 !h-5" />}
            {saving ? "Speichern..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* E-Mail Section */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold text-white">📧 E-Mail an Lead</h3>
          <div className="flex flex-wrap items-center gap-3">
            {lead.email_status && (
              <span
                className={`badge ${
                  lead.email_status === "draft"
                    ? "badge-gray"
                    : lead.email_status === "ready_to_send"
                    ? "badge-warning"
                    : "badge-success"
                }`}
              >
                {lead.email_status === "draft"
                  ? "📝 Entwurf"
                  : lead.email_status === "ready_to_send"
                  ? "🚀 Versandbereit"
                  : "✅ Gesendet"}
              </span>
            )}
            {lead.email_sent_at && (
              <span className="text-sm text-neutral-500">Gesendet: {formatDate(lead.email_sent_at)}</span>
            )}
          </div>
        </div>

        {!lead.email_draft ? (
          <div className="text-center py-12">
            <span className="text-5xl mb-4 block">✨</span>
            <p className="text-neutral-400 mb-6">Noch keine E-Mail generiert</p>
            <button onClick={generateEmail} disabled={generating} className="btn btn-primary">
              {generating && <Spinner className="!w-5 !h-5" />}
              {generating ? "Generiere..." : "✨ E-Mail generieren"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="form-label">Betreff</label>
              <input
                value={lead.email_subject || ""}
                onChange={(e) => setLead({ ...lead, email_subject: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Nachricht</label>
              <textarea
                value={lead.email_draft || ""}
                onChange={(e) => setLead({ ...lead, email_draft: e.target.value })}
                rows={15}
                className="input font-mono text-sm"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-4 border-t border-[#262626] gap-4">
              <button onClick={generateEmail} disabled={generating} className="btn btn-secondary">
                <RefreshCw className="w-4 h-4" />
                Neu generieren
              </button>

              <div className="flex flex-wrap gap-2">
                {lead.email_status === "draft" && (
                  <button onClick={() => setEmailStatus("ready_to_send")} className="btn btn-primary">
                    🚀 Zum Versand freigeben
                  </button>
                )}
                {lead.email_status === "ready_to_send" && (
                  <>
                    <button onClick={() => setEmailStatus("draft")} className="btn btn-secondary">
                      ↩️ Zurück zu Entwurf
                    </button>
                    <div className="px-4 py-3 bg-green-900/30 border border-green-800 text-green-400 rounded-xl text-sm">
                      ✓ Wird beim nächsten Heartbeat versendet
                    </div>
                  </>
                )}
                {lead.email_status === "sent" && (
                  <div className="px-4 py-3 bg-green-900/30 border border-green-800 text-green-400 rounded-xl">
                    ✅ E-Mail wurde gesendet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="card p-4 bg-[#111] text-sm text-neutral-500">
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <span>Erstellt: {formatDate(lead.created_at)}</span>
          <span>Aktualisiert: {formatDate(lead.updated_at)}</span>
          <span>Zugewiesen: {lead.assigned_to || "-"}</span>
        </div>
      </div>

      {/* Convert to Customer Modal */}
      <Modal
        open={showConvert}
        onClose={() => setShowConvert(false)}
        title="Lead zu Kunde konvertieren"
      >
        <form onSubmit={convertToCustomer} className="space-y-4">
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 text-sm">
            <p className="text-blue-300 font-medium mb-2">Folgende Daten werden übernommen:</p>
            <ul className="text-blue-400 space-y-1">
              <li>• Name: {lead.name}</li>
              {lead.company && <li>• Firma: {lead.company}</li>}
              {lead.email && <li>• E-Mail: {lead.email}</li>}
              {lead.phone && <li>• Telefon: {lead.phone}</li>}
            </ul>
          </div>

          <div>
            <label className="form-label">Kundentyp</label>
            <select
              value={convertForm.customer_type}
              onChange={(e) => setConvertForm({ ...convertForm, customer_type: e.target.value as typeof convertForm.customer_type })}
              className="input"
            >
              <option value="private">Privat</option>
              <option value="business">Geschäftskunde</option>
              <option value="public">Öffentlich</option>
            </select>
          </div>

          <div>
            <label className="form-label">Kundennummer (optional)</label>
            <input
              value={convertForm.customer_number}
              onChange={(e) => setConvertForm({ ...convertForm, customer_number: e.target.value })}
              className="input"
              placeholder="Wird automatisch generiert"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Straße & Hausnummer</label>
              <input
                value={convertForm.street}
                onChange={(e) => setConvertForm({ ...convertForm, street: e.target.value })}
                className="input"
                placeholder="Musterstraße 1"
              />
            </div>
            <div>
              <label className="form-label">PLZ</label>
              <input
                value={convertForm.zip}
                onChange={(e) => setConvertForm({ ...convertForm, zip: e.target.value })}
                className="input"
                placeholder="26427"
              />
            </div>
            <div>
              <label className="form-label">Ort</label>
              <input
                value={convertForm.city}
                onChange={(e) => setConvertForm({ ...convertForm, city: e.target.value })}
                className="input"
                placeholder="Esens"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={converting} className="btn btn-primary flex-1">
              {converting ? <Spinner className="!w-5 !h-5" /> : <UserPlus className="w-4 h-4" />}
              {converting ? "Konvertiere..." : "Kunde erstellen"}
            </button>
            <button type="button" onClick={() => setShowConvert(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
