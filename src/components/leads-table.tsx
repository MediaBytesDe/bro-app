"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { formatValue } from "@/lib/utils";
import type { Lead } from "@/types/database";

const statusOptions = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const sourceOptions = ["Website", "Empfehlung", "Telefon", "Email", "Social Media", "Messe", "Sonstiges"];

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

export function LeadsTable() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    source: string;
    status: string;
    notes: string;
    assigned_to: string;
    value: string;
  }>({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    status: "new",
    notes: "",
    assigned_to: "",
    value: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadLeads();
  }, []);

  async function loadLeads() {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  const filteredLeads = leads.filter((l) => {
    const matchesText =
      !filter ||
      l.name?.toLowerCase().includes(filter.toLowerCase()) ||
      l.company?.toLowerCase().includes(filter.toLowerCase()) ||
      l.email?.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = !statusFilter || l.status === statusFilter;
    return matchesText && matchesStatus;
  });

  function openNew() {
    setEditingLead(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      source: "",
      status: "new",
      notes: "",
      assigned_to: "",
      value: "",
    });
    setShowForm(true);
  }

  function openEdit(lead: Lead, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingLead(lead);
    setForm({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      source: lead.source || "",
      status: lead.status || "new",
      notes: lead.notes || "",
      assigned_to: lead.assigned_to || "",
      value: lead.value?.toString() || "",
    });
    setShowForm(true);
  }

  async function saveLead(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      value: form.value ? parseFloat(form.value) : null,
    };

    if (editingLead) {
      await supabase.from("leads").update(payload).eq("id", editingLead.id);
    } else {
      await supabase.from("leads").insert(payload);
    }
    setShowForm(false);
    await loadLeads();
  }

  async function deleteLead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Lead wirklich löschen?")) return;
    await supabase.from("leads").delete().eq("id", id);
    await loadLeads();
  }

  function getEmailStatusBadge(lead: Lead) {
    if (lead.email_status === "ready_to_send") return { icon: "🚀", text: "Bereit", class: "badge-warning" };
    if (lead.email_status === "sent") return { icon: "✅", text: "Gesendet", class: "badge-success" };
    if (lead.email_draft) return { icon: "📝", text: "Entwurf", class: "badge-gray" };
    return null;
  }

  return (
    <div className="card">
      {/* Toolbar */}
      <div className="p-4 border-b border-[#1f1f1f]">
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={openNew} className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Neuer Lead
          </button>

          <div className="flex flex-1 gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Suchen..."
              className="input flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input !w-auto"
            >
              <option value="">Alle Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lead List */}
      {loading ? (
        <div className="p-8 text-center">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Leads...</p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="p-12 text-center text-neutral-500">
          <span className="text-4xl mb-4 block">👥</span>
          Keine Leads gefunden
        </div>
      ) : (
        <div className="divide-y divide-[#1f1f1f]">
          {filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="list-item w-full text-left group cursor-pointer"
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              {/* Status Badge */}
              <span className={`badge ${statusColors[lead.status || "new"]} shrink-0`}>{statusLabels[lead.status || "new"]}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-white truncate">{lead.name}</h3>
                    {lead.company && <p className="text-sm text-neutral-500 truncate">{lead.company}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {lead.email && (
                        <span className="text-xs text-neutral-500 truncate max-w-[180px]">✉️ {lead.email}</span>
                      )}
                      {lead.source && <span className="text-xs text-neutral-600">📍 {lead.source}</span>}
                      {getEmailStatusBadge(lead) && (
                        <span className={`badge ${getEmailStatusBadge(lead)!.class} !py-0.5 !text-[10px]`}>
                          {getEmailStatusBadge(lead)!.icon} {getEmailStatusBadge(lead)!.text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  {lead.value && (
                    <span className="text-green-400 font-bold text-sm whitespace-nowrap">{formatValue(lead.value)}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => openEdit(lead, e)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0"
                  title="Bearbeiten"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => deleteLead(lead.id, e)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 hover:!text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Arrow */}
              <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0 sm:hidden" />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingLead ? "Lead bearbeiten" : "Neuer Lead"}>
        <form onSubmit={saveLead} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input"
              placeholder="Vor- und Nachname"
            />
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
            <label className="form-label">Firma</label>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="input"
              placeholder="Firmenname"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Quelle</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="input"
              >
                <option value="">-- Auswählen --</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Zugewiesen an</label>
              <input
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                className="input"
                placeholder="Person"
              />
            </div>
            <div>
              <label className="form-label">Wert (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="input"
              placeholder="Weitere Informationen..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn btn-primary flex-1">
              Speichern
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
