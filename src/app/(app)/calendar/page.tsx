"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  Calendar,
  Plus,
  Clock,
  MapPin,
  User,
  ChevronLeft,
  ChevronRight,
  Building2,
  Wrench,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Appointment, AppointmentType, AppointmentStatus, Customer, Project, Subcontractor } from "@/types/database";

// Partial customer type for dropdown selections
type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;

const typeLabels: Record<AppointmentType, string> = {
  aufmass: "Aufmaß",
  vob_termin: "VOB-Termin",
  montage_start: "Montage Start",
  montage_end: "Montage Ende",
  abnahme: "Abnahme",
  nachbesserung: "Nachbesserung",
  wartung: "Wartung",
  beratung: "Beratung",
  sonstiges: "Sonstiges",
};

const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Geplant",
  confirmed: "Bestätigt",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
  rescheduled: "Verschoben",
};

const statusColors: Record<AppointmentStatus, string> = {
  scheduled: "badge-info",
  confirmed: "badge-success",
  in_progress: "badge-warning",
  completed: "badge-gray",
  cancelled: "badge-error",
  rescheduled: "badge-purple",
};

interface AppointmentWithRelations extends Appointment {
  customers?: { company_name: string | null; first_name: string | null; last_name: string } | null;
  projects?: { name: string; icon: string | null } | null;
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<AppointmentWithRelations[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    appointment_type: "beratung" as AppointmentType,
    scheduled_date: new Date().toISOString().split("T")[0],
    scheduled_time: "09:00",
    duration_minutes: "60",
    customer_id: "",
    project_id: "",
    subcontractor_ids: [] as string[],
    location_address: "",
    notes: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  async function loadData() {
    setLoading(true);

    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const [appointmentsRes, customersRes, projectsRes, subcontractorsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("*, customers(company_name, first_name, last_name), projects(name, icon)")
        .gte("start_time", startOfMonth.toISOString())
        .lte("start_time", endOfMonth.toISOString())
        .order("start_time", { ascending: true }),
      supabase.from("customers").select("id, company_name, first_name, last_name").eq("status", "active"),
      supabase.from("projects").select("id, name, icon, slug"),
      supabase.from("subcontractors").select("id, company_name, trade").eq("status", "active"),
    ]);

    setAppointments(appointmentsRes.data || []);
    setCustomers(customersRes.data || []);
    setProjects(projectsRes.data || []);
    setSubcontractors(subcontractorsRes.data || []);
    setLoading(false);
  }

  function openNew(date?: Date) {
    setForm({
      title: "",
      appointment_type: "beratung",
      scheduled_date: (date || new Date()).toISOString().split("T")[0],
      scheduled_time: "09:00",
      duration_minutes: "60",
      customer_id: "",
      project_id: "",
      subcontractor_ids: [],
      location_address: "",
      notes: "",
    });
    setShowForm(true);
  }

  async function saveAppointment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Combine date and time into start_time
    const startTime = new Date(`${form.scheduled_date}T${form.scheduled_time}`);
    const durationMs = (parseInt(form.duration_minutes) || 60) * 60 * 1000;
    const endTime = new Date(startTime.getTime() + durationMs);

    const { error } = await supabase.from("appointments").insert({
      title: form.title || typeLabels[form.appointment_type].replace(/^[^\s]+\s/, ""),
      appointment_type: form.appointment_type,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      customer_id: form.customer_id || null,
      project_id: form.project_id || null,
      subcontractor_ids: form.subcontractor_ids.length > 0 ? form.subcontractor_ids : null,
      location_address: form.location_address || null,
      description: form.notes || null,
      status: "scheduled",
    });

    setSaving(false);

    if (error) {
      alert("Fehler beim Speichern: " + error.message);
      return;
    }

    setShowForm(false);
    await loadData();
  }

  function prevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  }

  // Group appointments by date
  const appointmentsByDate = appointments.reduce((acc, apt) => {
    const date = new Date(apt.start_time).toISOString().split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(apt);
    return acc;
  }, {} as Record<string, AppointmentWithRelations[]>);

  // Generate calendar days
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Monday = 0

  const calendarDays = [];
  for (let i = 0; i < adjustedFirstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth.getMonth() === today.getMonth() &&
    currentMonth.getFullYear() === today.getFullYear();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-orange-400" />
          Kalender
        </h1>
        <button onClick={() => openNew()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neuer Termin
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="btn btn-ghost btn-icon">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-medium text-white">
          {currentMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h2>
        <button onClick={nextMonth} className="btn btn-ghost btn-icon">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Termine...</p>
        </div>
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="card overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-[#1f1f1f]">
              {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-neutral-500">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="p-2 min-h-[80px] bg-[#0a0a0a]" />;
                }

                const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayAppointments = appointmentsByDate[dateStr] || [];

                return (
                  <div
                    key={day}
                    onClick={() => openNew(new Date(dateStr))}
                    className={`p-2 min-h-[80px] border-t border-r border-[#1f1f1f] cursor-pointer hover:bg-[#1a1a1a] transition-colors ${
                      isToday(day) ? "bg-orange-500/10" : ""
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        isToday(day)
                          ? "bg-orange-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                          : "text-neutral-400"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayAppointments.slice(0, 3).map((apt) => (
                        <div
                          key={apt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Could open detail modal here
                          }}
                          className={`text-xs p-1 rounded truncate ${
                            apt.status === "confirmed"
                              ? "bg-green-500/20 text-green-400"
                              : apt.status === "cancelled"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {new Date(apt.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} {apt.title}
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-xs text-neutral-500">
                          +{dayAppointments.length - 3} weitere
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming List */}
          <div className="card">
            <div className="p-4 border-b border-[#1f1f1f]">
              <h3 className="font-medium text-white">Anstehende Termine</h3>
            </div>
            <div className="divide-y divide-[#1f1f1f] max-h-[300px] overflow-y-auto">
              {appointments.filter((a) => a.status !== "cancelled" && a.status !== "completed").length === 0 ? (
                <p className="p-4 text-neutral-500 text-center">Keine anstehenden Termine</p>
              ) : (
                appointments
                  .filter((a) => a.status !== "cancelled" && a.status !== "completed")
                  .map((apt) => (
                    <div key={apt.id} className="p-3 flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">
                          {new Date(apt.start_time).getDate()}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {new Date(apt.start_time).toLocaleDateString("de-DE", { month: "short" })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{apt.title}</p>
                        <div className="flex items-center gap-3 text-sm text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(apt.start_time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {apt.customers && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {apt.customers.company_name || apt.customers.last_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${statusColors[apt.status]}`}>
                        {statusLabels[apt.status]}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}

      {/* New Appointment Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Neuer Termin">
        <form onSubmit={saveAppointment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label">Titel</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="z.B. Aufmaß bei Müller"
              />
            </div>
            <div>
              <label className="form-label">Terminart</label>
              <select
                value={form.appointment_type}
                onChange={(e) => setForm({ ...form, appointment_type: e.target.value as AppointmentType })}
                className="input"
              >
                {Object.entries(typeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Dauer (Min.)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="input"
                min="15"
                step="15"
              />
            </div>
            <div>
              <label className="form-label">Datum</label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="form-label">Uhrzeit</label>
              <input
                type="time"
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Kunde</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="input"
              >
                <option value="">-- Optional --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Projekt</label>
              <select
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                className="input"
              >
                <option value="">-- Optional --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Adresse</label>
            <input
              value={form.location_address}
              onChange={(e) => setForm({ ...form, location_address: e.target.value })}
              className="input"
              placeholder="Straße, PLZ Ort"
            />
          </div>

          <div>
            <label className="form-label">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : <Plus className="w-4 h-4" />}
              {saving ? "Speichern..." : "Termin erstellen"}
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
