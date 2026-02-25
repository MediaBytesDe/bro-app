"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  ChevronLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Trash2,
  Pencil,
  Plus,
  ExternalLink,
  Key,
  Copy,
  Check,
  UserPlus,
  UserX,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Customer, Quote, Project } from "@/types/database";

interface Props {
  customerId: string;
}

const statusColors: Record<string, string> = {
  active: "badge-success",
  inactive: "badge-gray",
  blocked: "badge-error",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  blocked: "Gesperrt",
};

export function CustomerDetail({ customerId }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Login management
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [deletingLogin, setDeletingLogin] = useState(false);
  const [newLoginData, setNewLoginData] = useState<{ email: string; password: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showDeleteLoginModal, setShowDeleteLoginModal] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    street: "",
    zip: "",
    city: "",
    country: "Deutschland",
    customer_type: "private" as "private" | "business" | "public",
    status: "active" as "active" | "inactive" | "blocked",
    notes: "",
    tax_id: "",
    vat_id: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  async function loadCustomer() {
    setLoading(true);
    try {
      // Load customer
      const { data: customerData } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerData) {
        setCustomer(customerData);
        setEditForm({
          company_name: customerData.company_name || "",
          first_name: customerData.first_name || "",
          last_name: customerData.last_name || "",
          email: customerData.email || "",
          phone: customerData.phone || "",
          mobile: customerData.mobile || "",
          street: customerData.street || "",
          zip: customerData.zip || "",
          city: customerData.city || "",
          country: customerData.country || "Deutschland",
          customer_type: customerData.customer_type || "private",
          status: customerData.status || "active",
          notes: customerData.notes || "",
          tax_id: customerData.tax_id || "",
          vat_id: customerData.vat_id || "",
        });

        // Load quotes for this customer
        const { data: quotesData } = await supabase
          .from("quotes")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        setQuotes(quotesData || []);

        // Load projects for this customer
        const { data: projectsData } = await supabase
          .from("projects")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        setProjects(projectsData || []);
      }
    } catch (err) {
      console.error("Customer load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("customers")
      .update({
        ...editForm,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    setCustomer((prev) => (prev ? { ...prev, ...editForm } : null));
    setShowEdit(false);
    setSaving(false);
  }

  async function deleteCustomer() {
    if (!confirm("Kunde wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    
    await supabase.from("customers").delete().eq("id", customerId);
    router.push("/customers");
  }

  async function syncToLexware() {
    setSyncing(true);
    try {
      const res = await fetch("/api/lexware/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Reload customer to get updated lexware_id
        await loadCustomer();
        alert(`✅ Erfolgreich mit Lexware synchronisiert!\nLexware ID: ${data.lexwareId}`);
      } else {
        alert(`❌ Sync fehlgeschlagen: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Sync fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    } finally {
      setSyncing(false);
    }
  }

  async function createLogin() {
    setCreatingLogin(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/create-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setNewLoginData({ email: data.email, password: data.password });
        await loadCustomer();
      } else {
        alert(`❌ Fehler: ${data.error}`);
        setShowLoginModal(false);
      }
    } catch (err) {
      alert(`❌ Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
      setShowLoginModal(false);
    } finally {
      setCreatingLogin(false);
    }
  }

  async function deleteLogin() {
    setDeletingLogin(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/delete-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const data = await res.json();
      
      if (data.success) {
        await loadCustomer();
        setShowDeleteLoginModal(false);
      } else {
        alert(`❌ Fehler: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Fehler: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    } finally {
      setDeletingLogin(false);
    }
  }

  async function copyPassword() {
    if (!newLoginData?.password) return;
    
    try {
      await navigator.clipboard.writeText(newLoginData.password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (err) {
      // Fallback for HTTP or older browsers
      const textArea = document.createElement("textarea");
      textArea.value = newLoginData.password;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Spinner className="mx-auto" />
        <p className="text-neutral-500 mt-4">Lade Kunde...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center text-neutral-500">
        <span className="text-4xl mb-4 block">❌</span>
        Kunde nicht gefunden
      </div>
    );
  }

  const displayName = customer.company_name || `${customer.first_name || ""} ${customer.last_name}`.trim();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.push("/customers")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Zurück zur Liste
        </button>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusColors[customer.status || "lead"]}`}>
            {statusLabels[customer.status || "lead"]}
          </span>
          {customer.customer_number && (
            <span className="text-neutral-500 text-sm">#{customer.customer_number}</span>
          )}
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Building2 className="w-7 h-7 text-orange-400" />
              {displayName}
            </h2>
            {customer.company_name && customer.first_name && (
              <p className="text-neutral-400 mt-1">
                Ansprechpartner: {customer.first_name} {customer.last_name}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={syncToLexware} disabled={syncing} className="btn btn-primary">
              {syncing ? <Spinner className="!w-4 !h-4" /> : <ExternalLink className="w-4 h-4" />}
              {syncing ? "Sync..." : customer.lexware_id ? "Lexware aktualisieren" : "Zu Lexware"}
            </button>
            <button onClick={() => setShowEdit(true)} className="btn btn-secondary">
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </button>
            <button onClick={deleteCustomer} className="btn btn-ghost hover:!bg-red-900/30 hover:!text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide">Kontakt</h3>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 text-white hover:text-orange-400 transition-colors">
                <Mail className="w-5 h-5 text-neutral-500" />
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-3 text-white hover:text-orange-400 transition-colors">
                <Phone className="w-5 h-5 text-neutral-500" />
                {customer.phone}
              </a>
            )}
            {customer.mobile && (
              <a href={`tel:${customer.mobile}`} className="flex items-center gap-3 text-white hover:text-orange-400 transition-colors">
                <Phone className="w-5 h-5 text-neutral-500" />
                {customer.mobile} (Mobil)
              </a>
            )}
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide">Adresse</h3>
            {(customer.street || customer.city) ? (
              <div className="flex items-start gap-3 text-white">
                <MapPin className="w-5 h-5 text-neutral-500 mt-0.5" />
                <div>
                  {customer.street && <div>{customer.street}</div>}
                  <div>
                    {customer.postal_code && `${customer.postal_code} `}
                    {customer.city}
                  </div>
                  {customer.country && customer.country !== "Deutschland" && (
                    <div className="text-neutral-500">{customer.country}</div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-neutral-500">Keine Adresse hinterlegt</p>
            )}
          </div>
        </div>

        {/* Kundenportal Login */}
        <div className="mt-6 pt-6 border-t border-[#262626]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide flex items-center gap-2">
              <Key className="w-4 h-4" />
              Kundenportal Login
            </h3>
            {(customer as any).auth_user_id ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Login aktiv
                </span>
                <button
                  onClick={() => setShowDeleteLoginModal(true)}
                  className="btn btn-ghost text-red-400 hover:!bg-red-900/30 min-h-[40px] px-4"
                >
                  <UserX className="w-4 h-4" />
                  Löschen
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!customer.email) {
                    alert("Kunde hat keine E-Mail-Adresse. Bitte zuerst E-Mail hinterlegen.");
                    return;
                  }
                  setShowLoginModal(true);
                }}
                className="btn btn-primary btn-sm"
              >
                <UserPlus className="w-4 h-4" />
                Login erstellen
              </button>
            )}
          </div>
          {(customer as any).auth_user_id && customer.email && (
            <p className="text-sm text-neutral-500 mt-2">
              Anmeldung mit: <span className="text-white">{customer.email}</span>
            </p>
          )}
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="mt-6 pt-6 border-t border-[#262626]">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide mb-2">Notizen</h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Quotes Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Angebote ({quotes.length})
          </h3>
          <button className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Neues Angebot
          </button>
        </div>

        {quotes.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Noch keine Angebote</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                onClick={() => router.push(`/quotes/${quote.id}`)}
              >
                <div>
                  <span className="font-medium text-white">
                    {quote.quote_number || "Entwurf"}
                  </span>
                  <span className="text-neutral-500 ml-3">
                    {formatDate(quote.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-medium">
                    {quote.gross_amount?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </span>
                  <ExternalLink className="w-4 h-4 text-neutral-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Projekte ({projects.length})
          </h3>
          <button className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            Neues Projekt
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Noch keine Projekte</p>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                onClick={() => router.push(`/projects/${project.slug}`)}
              >
                <div className="flex items-center gap-3">
                  {project.icon && <span>{project.icon}</span>}
                  <span className="font-medium text-white">{project.name}</span>
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-500" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="card p-4 bg-[#111] text-sm text-neutral-500">
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <span>Erstellt: {formatDate(customer.created_at)}</span>
          <span>Aktualisiert: {formatDate(customer.updated_at)}</span>
          {customer.lexware_id && (
            <span className="text-blue-400">Lexware: {customer.lexware_id}</span>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Kunde bearbeiten">
        <form onSubmit={saveCustomer} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Kundentyp</label>
              <select
                value={editForm.customer_type}
                onChange={(e) => setEditForm({ ...editForm, customer_type: e.target.value as typeof editForm.customer_type })}
                className="input"
              >
                <option value="private">Privat</option>
                <option value="business">Geschäftskunde</option>
                <option value="public">Öffentlich</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as typeof editForm.status })}
                className="input"
              >
                <option value="active">Aktiv</option>
                <option value="inactive">Inaktiv</option>
                <option value="blocked">Gesperrt</option>
              </select>
            </div>
          </div>

          {editForm.customer_type === "business" && (
            <div>
              <label className="form-label">Firmenname</label>
              <input
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                className="input"
                placeholder="GmbH, AG, etc."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Vorname</label>
              <input
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Nachname *</label>
              <input
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Telefon</label>
              <input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Straße & Hausnummer</label>
            <input
              value={editForm.street}
              onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">PLZ</label>
              <input
                value={editForm.zip}
                onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Ort</label>
              <input
                value={editForm.city}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notizen</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={3}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : null}
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <button type="button" onClick={() => setShowEdit(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Login Modal */}
      <Modal 
        open={showLoginModal} 
        onClose={() => { setShowLoginModal(false); setNewLoginData(null); }} 
        title="Kundenportal Login erstellen"
      >
        <div className="space-y-4">
          {!newLoginData ? (
            <>
              <p className="text-neutral-300">
                Ein Login für das Kundenportal wird erstellt für:
              </p>
              <div className="p-4 bg-[#1a1a1a] rounded-xl">
                <p className="text-white font-medium">{customer.email}</p>
                <p className="text-sm text-neutral-500 mt-1">
                  Ein sicheres Passwort wird automatisch generiert.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="flex-1 btn btn-secondary"
                >
                  Abbrechen
                </button>
                <button
                  onClick={createLogin}
                  disabled={creatingLogin}
                  className="flex-1 btn btn-primary"
                >
                  {creatingLogin ? "Erstellen..." : "Login erstellen"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-400 font-medium flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Login erfolgreich erstellt!
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="form-label">E-Mail</label>
                  <div className="input bg-[#0a0a0a]">{newLoginData.email}</div>
                </div>
                <div>
                  <label className="form-label">Passwort</label>
                  <div className="flex gap-2">
                    <div className="input bg-[#0a0a0a] flex-1 font-mono">{newLoginData.password}</div>
                    <button
                      onClick={copyPassword}
                      className="btn btn-secondary"
                      title="Passwort kopieren"
                    >
                      {copiedPassword ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-yellow-500">
                ⚠️ Bitte teile diese Zugangsdaten sicher mit dem Kunden. Das Passwort wird nicht erneut angezeigt.
              </p>
              <button
                onClick={() => { setShowLoginModal(false); setNewLoginData(null); }}
                className="btn btn-primary w-full"
              >
                Fertig
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Delete Login Modal */}
      <Modal 
        open={showDeleteLoginModal} 
        onClose={() => setShowDeleteLoginModal(false)} 
        title="Login löschen"
      >
        <div className="space-y-4">
          <p className="text-neutral-300">
            Möchtest du den Kundenportal-Login für <span className="font-semibold text-white">{customer.email}</span> wirklich löschen?
          </p>
          <p className="text-sm text-neutral-500">
            Der Kunde kann sich danach nicht mehr im Kundenportal anmelden.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowDeleteLoginModal(false)}
              className="flex-1 btn btn-secondary"
            >
              Abbrechen
            </button>
            <button
              onClick={deleteLogin}
              disabled={deletingLogin}
              className="flex-1 btn bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingLogin ? "Löschen..." : "Login löschen"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
