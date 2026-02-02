"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  Wrench,
  Mail,
  Phone,
  MapPin,
  Star,
  Pencil,
  Trash2,
  Calendar,
  Briefcase,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Subcontractor, Project, Appointment, TradeType } from "@/types/database";

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
  pending: "In Prüfung",
  blacklisted: "Gesperrt",
};

const statusColors = {
  active: "badge-success",
  inactive: "badge-gray",
  pending: "badge-warning",
  blacklisted: "badge-error",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default function SubcontractorDetailPage({ params }: Props) {
  const { id } = use(params);
  const [subcontractor, setSubcontractor] = useState<Subcontractor | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<Project[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [editForm, setEditForm] = useState({
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
    status: "active" as "active" | "inactive" | "pending" | "blacklisted",
    rating: "",
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);

    // Load subcontractor
    const { data: sub } = await supabase
      .from("subcontractors")
      .select("*")
      .eq("id", id)
      .single();

    if (sub) {
      setSubcontractor(sub);
      setEditForm({
        company_name: sub.company_name || "",
        trade: sub.trade || "elektriker",
        contact_name: sub.contact_name || "",
        contact_email: sub.contact_email || "",
        contact_phone: sub.contact_phone || "",
        street: sub.street || "",
        zip: sub.zip || "",
        city: sub.city || "",
        tax_id: sub.tax_id || "",
        hourly_rate: sub.hourly_rate?.toString() || "",
        notes: sub.notes || "",
        status: sub.status || "active",
        rating: sub.rating?.toString() || "",
      });

      // Load assigned projects
      const { data: assignments } = await supabase
        .from("project_subcontractors")
        .select("project_id, projects(*)")
        .eq("subcontractor_id", id);

      if (assignments) {
        setAssignedProjects(
          assignments
            .map((a) => a.projects as unknown as Project)
            .filter(Boolean)
        );
      }

      // Load appointments
      const { data: appts } = await supabase
        .from("appointments")
        .select("*")
        .contains("subcontractor_ids", [id])
        .order("scheduled_date", { ascending: true });

      setAppointments(appts || []);
    }

    // Load all projects for assignment
    const { data: allProjects } = await supabase
      .from("projects")
      .select("id, name, slug")
      .order("name");

    setProjects(allProjects || []);
    setLoading(false);
  }

  async function saveSubcontractor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("subcontractors")
      .update({
        company_name: editForm.company_name,
        trade: editForm.trade,
        contact_name: editForm.contact_name || null,
        contact_email: editForm.contact_email || null,
        contact_phone: editForm.contact_phone || null,
        street: editForm.street || null,
        zip: editForm.zip || null,
        city: editForm.city || null,
        tax_id: editForm.tax_id || null,
        hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate) : null,
        notes: editForm.notes || null,
        status: editForm.status,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
      })
      .eq("id", id);

    setSubcontractor((prev) => (prev ? { ...prev, ...editForm } : null));
    setShowEdit(false);
    setSaving(false);
  }

  async function deleteSubcontractor() {
    if (!confirm("Subunternehmer wirklich löschen?")) return;

    await supabase.from("subcontractors").delete().eq("id", id);
    router.push("/subcontractors");
  }

  async function assignToProject(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;

    setSaving(true);

    await supabase.from("project_subcontractors").insert({
      project_id: selectedProjectId,
      subcontractor_id: id,
    });

    setShowAssign(false);
    setSelectedProjectId("");
    setSaving(false);
    await loadData();
  }

  async function removeFromProject(projectId: string) {
    if (!confirm("Zuordnung wirklich entfernen?")) return;

    await supabase
      .from("project_subcontractors")
      .delete()
      .eq("project_id", projectId)
      .eq("subcontractor_id", id);

    await loadData();
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Spinner className="mx-auto" />
        <p className="text-neutral-500 mt-4">Lade Subunternehmer...</p>
      </div>
    );
  }

  if (!subcontractor) {
    return (
      <div className="p-12 text-center text-neutral-500">
        <span className="text-4xl mb-4 block">❌</span>
        Subunternehmer nicht gefunden
      </div>
    );
  }

  // Filter out already assigned projects
  const availableProjects = projects.filter(
    (p) => !assignedProjects.some((ap) => ap.id === p.id)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.push("/subcontractors")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Zurück zur Liste
        </button>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusColors[subcontractor.status]}`}>
            {statusLabels[subcontractor.status]}
          </span>
          {subcontractor.rating && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Star className="w-4 h-4 fill-current" />
              {subcontractor.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Main Info Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Wrench className="w-7 h-7 text-orange-400" />
              {subcontractor.company_name}
            </h2>
            <span className="inline-block mt-2 text-sm px-2 py-1 rounded bg-neutral-800 text-neutral-300">
              {tradeLabels[subcontractor.trade]}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEdit(true)} className="btn btn-secondary">
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </button>
            <button
              onClick={deleteSubcontractor}
              className="btn btn-ghost hover:!bg-red-900/30 hover:!text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide">
              Ansprechpartner
            </h3>
            {subcontractor.contact_name && (
              <p className="text-white">{subcontractor.contact_name}</p>
            )}
            {subcontractor.contact_email && (
              <a
                href={`mailto:${subcontractor.contact_email}`}
                className="flex items-center gap-3 text-white hover:text-orange-400 transition-colors"
              >
                <Mail className="w-5 h-5 text-neutral-500" />
                {subcontractor.contact_email}
              </a>
            )}
            {subcontractor.contact_phone && (
              <a
                href={`tel:${subcontractor.contact_phone}`}
                className="flex items-center gap-3 text-white hover:text-orange-400 transition-colors"
              >
                <Phone className="w-5 h-5 text-neutral-500" />
                {subcontractor.contact_phone}
              </a>
            )}
          </div>

          {/* Address & Details */}
          <div className="space-y-3">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide">
              Details
            </h3>
            {(subcontractor.street || subcontractor.city) && (
              <div className="flex items-start gap-3 text-white">
                <MapPin className="w-5 h-5 text-neutral-500 mt-0.5" />
                <div>
                  {subcontractor.street && <div>{subcontractor.street}</div>}
                  <div>
                    {subcontractor.zip && `${subcontractor.zip} `}
                    {subcontractor.city}
                  </div>
                </div>
              </div>
            )}
            {subcontractor.hourly_rate && (
              <p className="text-green-400 font-medium">
                {subcontractor.hourly_rate.toLocaleString("de-DE", {
                  style: "currency",
                  currency: "EUR",
                })}{" "}
                / Stunde
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        {subcontractor.notes && (
          <div className="mt-6 pt-6 border-t border-[#262626]">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide mb-2">
              Notizen
            </h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{subcontractor.notes}</p>
          </div>
        )}
      </div>

      {/* Assigned Projects */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-blue-400" />
            Zugewiesene Projekte ({assignedProjects.length})
          </h3>
          {availableProjects.length > 0 && (
            <button onClick={() => setShowAssign(true)} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4" />
              Zuweisen
            </button>
          )}
        </div>

        {assignedProjects.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Noch keine Projekte zugewiesen</p>
        ) : (
          <div className="space-y-2">
            {assignedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] transition-colors"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer flex-1"
                  onClick={() => router.push(`/projects/${project.slug}`)}
                >
                  {project.icon && <span>{project.icon}</span>}
                  <span className="font-medium text-white">{project.name}</span>
                </div>
                <button
                  onClick={() => removeFromProject(project.id)}
                  className="btn btn-ghost btn-sm hover:!text-red-400"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Termine ({appointments.length})
          </h3>
        </div>

        {appointments.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">Keine Termine vorhanden</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-[#111]"
              >
                {appt.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : appt.status === "cancelled" ? (
                  <XCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <Clock className="w-5 h-5 text-yellow-400" />
                )}
                <div className="flex-1">
                  <span className="font-medium text-white">{appt.title}</span>
                  <p className="text-sm text-neutral-500">
                    {formatDate(appt.scheduled_date)}
                    {appt.scheduled_time && ` um ${appt.scheduled_time}`}
                  </p>
                </div>
                <span
                  className={`badge ${
                    appt.status === "completed"
                      ? "badge-success"
                      : appt.status === "cancelled"
                      ? "badge-error"
                      : "badge-warning"
                  }`}
                >
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="card p-4 bg-[#111] text-sm text-neutral-500">
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <span>Erstellt: {formatDate(subcontractor.created_at)}</span>
          <span>Aktualisiert: {formatDate(subcontractor.updated_at)}</span>
          {subcontractor.tax_id && <span>USt-ID: {subcontractor.tax_id}</span>}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Subunternehmer bearbeiten">
        <form onSubmit={saveSubcontractor} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Firmenname *</label>
              <input
                value={editForm.company_name}
                onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="form-label">Gewerk</label>
              <select
                value={editForm.trade}
                onChange={(e) => setEditForm({ ...editForm, trade: e.target.value as TradeType })}
                className="input"
              >
                {Object.entries(tradeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as typeof editForm.status })}
                className="input"
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Stundensatz (€)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.hourly_rate}
                onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Bewertung (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={editForm.rating}
                onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Ansprechpartner</label>
              <input
                value={editForm.contact_name}
                onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">E-Mail</label>
              <input
                type="email"
                value={editForm.contact_email}
                onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="form-label">Telefon</label>
              <input
                value={editForm.contact_phone}
                onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
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

      {/* Assign Project Modal */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Projekt zuweisen">
        <form onSubmit={assignToProject} className="space-y-4">
          <div>
            <label className="form-label">Projekt auswählen</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="input"
              required
            >
              <option value="">-- Projekt wählen --</option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving || !selectedProjectId} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : <Plus className="w-4 h-4" />}
              {saving ? "Zuweisen..." : "Zuweisen"}
            </button>
            <button type="button" onClick={() => setShowAssign(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
