"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Building2, Plus, Search, Phone, Mail, ChevronRight, RefreshCw, CloudDownload, Check, AlertTriangle } from "lucide-react";
import type { Customer } from "@/types/database";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    customer_type: "private" as "private" | "business" | "public",
    company_name: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    street: "",
    zip: "",
    city: "",
    notes: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  const filtered = customers.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.last_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.first_name?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q);
  });

  function openNew() {
    setForm({
      customer_type: "private",
      company_name: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      mobile: "",
      street: "",
      zip: "",
      city: "",
      notes: "",
    });
    setShowForm(true);
  }

  async function saveCustomer(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await supabase
      .from("customers")
      .insert({
        customer_type: form.customer_type,
        company_name: form.company_name || null,
        first_name: form.first_name || null,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        street: form.street || null,
        zip: form.zip || null,
        city: form.city || null,
        notes: form.notes || null,
        status: "active",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      alert("Fehler beim Speichern: " + error.message);
      return;
    }

    setShowForm(false);
    
    // Sync to Lexware in background
    if (data) {
      fetch("/api/lexware/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", customerId: data.id }),
      }).catch(console.error);
      
      router.push(`/customers/${data.id}`);
    } else {
      await loadCustomers();
    }
  }

  async function importFromLexware() {
    setImporting(true);
    setSyncMessage(null);
    
    try {
      const res = await fetch("/api/lexware/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import" }),
      });
      
      const result = await res.json();
      
      if (result.error) {
        setSyncMessage({ type: "error", text: result.error });
      } else {
        setSyncMessage({ 
          type: "success", 
          text: `${result.imported} importiert, ${result.skipped} übersprungen` 
        });
        await loadCustomers();
      }
    } catch (err) {
      setSyncMessage({ type: "error", text: "Verbindungsfehler" });
    } finally {
      setImporting(false);
    }
  }

  async function syncAllToLexware() {
    setSyncing(true);
    setSyncMessage(null);
    
    const customersToSync = customers.filter(c => c.status === "active");
    let synced = 0;
    let errors = 0;
    
    for (const customer of customersToSync) {
      try {
        const res = await fetch("/api/lexware/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync", customerId: customer.id }),
        });
        const result = await res.json();
        if (result.success) synced++;
        else errors++;
      } catch {
        errors++;
      }
    }
    
    setSyncMessage({ 
      type: errors === 0 ? "success" : "error",
      text: `${synced} synchronisiert${errors > 0 ? `, ${errors} Fehler` : ""}`
    });
    await loadCustomers();
    setSyncing(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-white">
          Kunden
          <span className="text-neutral-500 font-normal text-sm ml-1">
            ({filtered.length})
          </span>
        </h1>
        <div className="flex items-center gap-1">
          <button 
            onClick={importFromLexware} 
            disabled={importing}
            className="btn btn-ghost btn-sm p-2"
            title="Von Lexware importieren"
          >
            {importing ? <Spinner className="!w-4 !h-4" /> : <CloudDownload className="w-4 h-4" />}
          </button>
          <button 
            onClick={syncAllToLexware}
            disabled={syncing}
            className="btn btn-ghost btn-sm p-2"
            title="Alle zu Lexware synchronisieren"
          >
            {syncing ? <Spinner className="!w-4 !h-4" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button onClick={openNew} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neu</span>
          </button>
        </div>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className={`flex items-center gap-2 p-3 rounded-lg ${
          syncMessage.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"
        }`}>
          {syncMessage.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm">{syncMessage.text}</span>
          <button onClick={() => setSyncMessage(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10 w-full"
        />
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Kunden...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-500">Noch keine Kunden vorhanden</p>
          <p className="text-neutral-600 text-sm mt-1">
            Konvertiere Leads zu Kunden oder lege neue an
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[#1a1a1a]">
          {filtered.map((customer) => (
            <div
              key={customer.id}
              onClick={() => router.push(`/customers/${customer.id}`)}
              className="p-3 sm:p-4 cursor-pointer active:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {customer.company_name || `${customer.first_name || ""} ${customer.last_name}`.trim()}
                    </span>
                    {customer.lexware_id && (
                      <span className="text-[10px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">LX</span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-500 mt-0.5 truncate">
                    {customer.city || customer.email || customer.phone || "Keine Details"}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Customer Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Neuer Kunde">
        <form onSubmit={saveCustomer} className="space-y-4">
          <div>
            <label className="form-label">Kundentyp</label>
            <select
              value={form.customer_type}
              onChange={(e) => setForm({ ...form, customer_type: e.target.value as typeof form.customer_type })}
              className="input"
            >
              <option value="private">Privat</option>
              <option value="business">Geschäftskunde</option>
              <option value="public">Öffentlich</option>
            </select>
          </div>

          {form.customer_type === "business" && (
            <div>
              <label className="form-label">Firmenname</label>
              <input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="input"
                placeholder="GmbH, AG, etc."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Vorname</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Nachname *</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
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
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="form-label">Telefon</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
                placeholder="+49 ..."
              />
            </div>
          </div>

          <div>
            <label className="form-label">Straße & Hausnummer</label>
            <input
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
              className="input"
              placeholder="Musterstraße 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">PLZ</label>
              <input
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                className="input"
                placeholder="26427"
              />
            </div>
            <div>
              <label className="form-label">Ort</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
                placeholder="Esens"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input"
              placeholder="Weitere Informationen..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : <Plus className="w-4 h-4" />}
              {saving ? "Speichern..." : "Kunde erstellen"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
