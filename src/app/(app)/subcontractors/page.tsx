"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  Wrench,
  Plus,
  Search,
  Phone,
  Mail,
  Star,
  MapPin,
  ChevronRight,
  Filter,
} from "lucide-react";
import type { Subcontractor, TradeType } from "@/types/database";

const tradeLabels: Record<TradeType, string> = {
  elektriker: "⚡ Elektriker",
  dachdecker: "🏠 Dachdecker",
  sanitaer: "🚿 Sanitär",
  heizung: "🔥 Heizung",
  klima: "❄️ Klima",
  maler: "🎨 Maler",
  trockenbau: "🧱 Trockenbau",
  geruestbau: "🏗️ Gerüstbau",
  tiefbau: "⛏️ Tiefbau",
  zimmerer: "🪵 Zimmerer",
  sonstige: "🔧 Sonstige",
};

const statusLabels = {
  active: "Aktiv",
  inactive: "Inaktiv",
  pending: "Prüfung",
  blacklisted: "Gesperrt",
};

export default function SubcontractorsPage() {
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    trade: "elektriker" as TradeType,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    street: "",
    zip: "",
    city: "",
    tax_id: "",
    hourly_rate: "",
    notes: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadSubcontractors();
  }, []);

  async function loadSubcontractors() {
    setLoading(true);
    const { data } = await supabase
      .from("subcontractors")
      .select("*")
      .order("company_name");
    setSubcontractors(data || []);
    setLoading(false);
  }

  const filtered = subcontractors.filter((s) => {
    const matchesSearch =
      !search ||
      s.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase());
    const matchesTrade = !tradeFilter || s.trade === tradeFilter;
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesTrade && matchesStatus;
  });

  // Group by trade for stats
  const tradeStats = subcontractors.reduce((acc, s) => {
    acc[s.trade] = (acc[s.trade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function openNew() {
    setForm({
      company_name: "",
      trade: "elektriker",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      street: "",
      zip: "",
      city: "",
      tax_id: "",
      hourly_rate: "",
      notes: "",
    });
    setShowForm(true);
  }

  async function saveSubcontractor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data, error } = await supabase
      .from("subcontractors")
      .insert({
        company_name: form.company_name,
        trade: form.trade,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        street: form.street || null,
        zip: form.zip || null,
        city: form.city || null,
        tax_id: form.tax_id || null,
        hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        notes: form.notes || null,
        status: "pending",
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      alert("Fehler beim Speichern: " + error.message);
      return;
    }

    setShowForm(false);

    if (data) {
      router.push(`/subcontractors/${data.id}`);
    } else {
      await loadSubcontractors();
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Wrench className="w-6 h-6 text-orange-400" />
          Subunternehmer
          <span className="text-neutral-500 font-normal text-base ml-2">
            ({filtered.length})
          </span>
        </h1>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neuer Subuntern.
        </button>
      </div>

      {/* Trade Stats */}
      {Object.keys(tradeStats).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(tradeStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([trade, count]) => (
              <button
                key={trade}
                onClick={() => setTradeFilter(tradeFilter === trade ? "" : trade)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  tradeFilter === trade
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/50"
                    : "bg-[#1a1a1a] text-neutral-400 border border-transparent hover:border-[#333]"
                }`}
              >
                {tradeLabels[trade as TradeType] || trade} ({count})
              </button>
            ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Alle Gewerke</option>
          {Object.entries(tradeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Alle Status</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Subcontractor List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Subunternehmer...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-500">Keine Subunternehmer gefunden</p>
          <p className="text-neutral-600 text-sm mt-1">
            Füge deine ersten Handwerkspartner hinzu
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[#1f1f1f]">
          {filtered.map((sub) => (
            <div
              key={sub.id}
              onClick={() => router.push(`/subcontractors/${sub.id}`)}
              className="list-item cursor-pointer group"
            >
              {/* Trade Badge */}
              <span className="badge badge-gray shrink-0">
                {tradeLabels[sub.trade] || sub.trade}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {sub.company_name}
                  </span>
                  {sub.rating && (
                    <span className="flex items-center gap-0.5 text-yellow-400 text-sm">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      {sub.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                  {sub.contact_name && <span>{sub.contact_name}</span>}
                  {sub.contact_email && (
                    <span className="flex items-center gap-1 truncate max-w-[180px]">
                      <Mail className="w-3 h-3 shrink-0" />
                      {sub.contact_email}
                    </span>
                  )}
                  {sub.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 shrink-0" />
                      {sub.contact_phone}
                    </span>
                  )}
                  {sub.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {sub.city}
                    </span>
                  )}
                </div>
              </div>

              {/* Status */}
              <span
                className={`badge shrink-0 ${
                  sub.status === "active"
                    ? "badge-success"
                    : sub.status === "pending"
                    ? "badge-warning"
                    : sub.status === "blacklisted"
                    ? "badge-error"
                    : "badge-gray"
                }`}
              >
                {statusLabels[sub.status as keyof typeof statusLabels] || sub.status}
              </span>

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0 group-hover:text-white transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* New Subcontractor Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Neuer Subunternehmer"
      >
        <form onSubmit={saveSubcontractor} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Firmenname *</label>
              <input
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
                className="input"
                placeholder="Musterfirma GmbH"
                required
              />
            </div>
            <div>
              <label className="form-label">Gewerk *</label>
              <select
                value={form.trade}
                onChange={(e) =>
                  setForm({ ...form, trade: e.target.value as TradeType })
                }
                className="input"
                required
              >
                {Object.entries(tradeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Stundensatz (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.hourly_rate}
                onChange={(e) =>
                  setForm({ ...form, hourly_rate: e.target.value })
                }
                className="input"
                placeholder="45.00"
              />
            </div>
          </div>

          <div className="border-t border-[#262626] pt-4">
            <h4 className="text-sm font-medium text-neutral-400 mb-3">
              Ansprechpartner
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Name</label>
                <input
                  value={form.contact_name}
                  onChange={(e) =>
                    setForm({ ...form, contact_name: e.target.value })
                  }
                  className="input"
                  placeholder="Max Mustermann"
                />
              </div>
              <div>
                <label className="form-label">E-Mail</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) =>
                    setForm({ ...form, contact_email: e.target.value })
                  }
                  className="input"
                  placeholder="info@firma.de"
                />
              </div>
              <div>
                <label className="form-label">Telefon</label>
                <input
                  value={form.contact_phone}
                  onChange={(e) =>
                    setForm({ ...form, contact_phone: e.target.value })
                  }
                  className="input"
                  placeholder="+49 ..."
                />
              </div>
            </div>
          </div>

          <div className="border-t border-[#262626] pt-4">
            <h4 className="text-sm font-medium text-neutral-400 mb-3">Adresse</h4>
            <div className="space-y-3">
              <div>
                <label className="form-label">Straße</label>
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
            </div>
          </div>

          <div>
            <label className="form-label">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input"
              placeholder="Interne Notizen..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? (
                <Spinner className="!w-5 !h-5" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {saving ? "Speichern..." : "Erstellen"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
