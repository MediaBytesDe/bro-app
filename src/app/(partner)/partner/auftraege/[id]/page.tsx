"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { 
  ArrowLeft,
  Calendar, 
  MapPin, 
  Phone,
  Mail,
  Clock,
  FileText,
  Users,
  MessageSquare,
  CheckCircle,
  XCircle,
  Play,
  ClipboardCheck,
  ExternalLink,
  Download
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";

interface Job {
  id: string;
  title: string;
  description: string;
  trade: string;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  estimated_hours: number;
  status: string;
  accepted_by_partner_id: string;
  assigned_to_user_id: string;
  partner_scheduled_date: string | null;
  partner_scheduled_time: string | null;
  partner_scheduled_notes: string | null;
  project: {
    id: string;
    name: string;
    slug: string;
    customer: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      mobile: string;
      street: string;
      house_number: string;
      city: string;
      postal_code: string;
    };
  };
}

interface TeamMember {
  id: string;
  title: string;
  trade: string;
  scheduled_date: string;
  scheduled_time_start: string;
  status: string;
  partner: {
    company_name: string;
  };
  assigned_user?: {
    display_name: string;
  };
}

interface Document {
  id: string;
  name: string;
  type: string;
  file_url: string;
  created_at: string;
}

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [teamJobs, setTeamJobs] = useState<TeamMember[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Termine-State (mehrere Termine pro Auftrag)
  const [appointments, setAppointments] = useState<any[]>([]);
  const [editingAppointment, setEditingAppointment] = useState<string | null>(null); // id oder 'new'
  const [appointmentForm, setAppointmentForm] = useState({
    title: '',
    date: '',
    time_start: '',
    time_end: '',
    notes: ''
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    try {
      // Trades aus DB laden (für Labels) - force reload beim ersten Mal
      await loadTradesFromDB(supabase, true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get partner user
      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) { setLoading(false); return; }
      setPartnerUser(pu);

    // Get job details
    const { data: jobData, error } = await supabase
      .from("partner_jobs")
      .select(`
        *,
        project:projects (
          id, name, slug,
          customer:customers (
            id, first_name, last_name, email, phone, mobile, street, house_number, city, postal_code
          )
        )
      `)
      .eq("id", jobId)
      .single();

    if (error || !jobData) {
      router.push("/partner/auftraege");
      return;
    }

    setJob(jobData);

    // Get other jobs in same project (team)
    const { data: otherJobs } = await supabase
      .from("partner_jobs")
      .select(`
        id, title, trade, scheduled_date, scheduled_time_start, status,
        partner:partners!accepted_by_partner_id (company_name),
        assigned_user:partner_users!assigned_to_user_id (display_name)
      `)
      .eq("project_id", jobData.project.id)
      .neq("id", jobId)
      .neq("status", "declined");

    setTeamJobs(otherJobs || []);

    // Get documents for this project (visible to partners)
    const { data: docs } = await supabase
      .from("documents")
      .select("id, name, type, file_url, created_at")
      .eq("project_id", jobData.project.id)
      .eq("visible_to_partners", true)
      .order("created_at", { ascending: false });

    setDocuments(docs || []);

    // If admin, get team members for assignment
    if (pu.role === 'admin') {
      const { data: team } = await supabase
        .from("partner_users")
        .select("id, display_name, role")
        .eq("partner_id", pu.partner_id)
        .eq("active", true);
      
      setTeamMembers(team || []);
    }

    // Load appointments for ALL jobs in this project (own + other subs)
      const allJobIds = [jobId, ...(otherJobs?.map(j => j.id) || [])];
      const { data: appts } = await supabase
        .from("partner_job_appointments")
        .select(`
          *,
          job:partner_jobs!job_id (
            id, title, trade,
            partner:partners!accepted_by_partner_id (company_name)
          )
        `)
        .in("job_id", allJobIds)
        .order("date", { ascending: true });
      
      setAppointments(appts || []);
    } catch (err) {
      console.error("Error loading job:", err);
    } finally {
      setLoading(false);
    }
  }

  async function acceptJob() {
    if (!job || !partnerUser) return;
    
    // Verbindliche Bestätigung
    const confirmed = confirm(
      "Auftrag verbindlich annehmen?\n\n" +
      "Mit der Annahme verpflichten Sie sich zur Durchführung des Auftrags. " +
      "Sie erhalten dann Zugriff auf die vollständigen Kundendaten."
    );
    if (!confirmed) return;
    
    setActionLoading(true);

    const { error } = await supabase
      .from("partner_jobs")
      .update({
        status: "accepted",
        accepted_by_partner_id: partnerUser.partner_id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "open"); // Only if still open

    if (error) {
      toast.error("Fehler beim Annehmen");
    } else {
      toast.success("Auftrag angenommen! Sie sehen jetzt die Kundendaten.");
      loadData();
    }
    setActionLoading(false);
  }

  async function declineJob() {
    if (!job) return;
    const reason = prompt("Grund für Ablehnung (optional):");
    setActionLoading(true);

    const { error } = await supabase
      .from("partner_jobs")
      .update({
        status: "declined",
        declined_reason: reason || null,
      })
      .eq("id", job.id);

    if (error) {
      toast.error("Fehler");
    } else {
      toast.success("Auftrag abgelehnt");
      router.push("/partner/auftraege");
    }
    setActionLoading(false);
  }

  async function startJob() {
    if (!job) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("partner_jobs")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) {
      toast.error("Fehler");
    } else {
      toast.success("Auftrag gestartet");
      loadData();
    }
    setActionLoading(false);
  }

  async function assignToUser(userId: string) {
    if (!job) return;
    setActionLoading(true);

    const { error } = await supabase
      .from("partner_jobs")
      .update({
        assigned_to_user_id: userId,
        assigned_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) {
      toast.error("Fehler beim Zuweisen");
    } else {
      toast.success("Mitarbeiter zugewiesen");
      loadData();
    }
    setActionLoading(false);
  }

  async function saveAppointment() {
    if (!job || !partnerUser) return;
    if (!appointmentForm.title || !appointmentForm.date) {
      toast.error("Titel und Datum sind erforderlich");
      return;
    }
    setActionLoading(true);

    if (editingAppointment === 'new') {
      // Neuer Termin
      const { error } = await supabase
        .from("partner_job_appointments")
        .insert({
          job_id: job.id,
          partner_id: partnerUser.partner_id,
          title: appointmentForm.title,
          date: appointmentForm.date,
          time_start: appointmentForm.time_start || null,
          time_end: appointmentForm.time_end || null,
          notes: appointmentForm.notes || null,
          created_by: partnerUser.id,
        });

      if (error) {
        toast.error("Fehler beim Erstellen");
      } else {
        toast.success("Termin erstellt");
      }
    } else {
      // Bestehenden Termin aktualisieren
      const { error } = await supabase
        .from("partner_job_appointments")
        .update({
          title: appointmentForm.title,
          date: appointmentForm.date,
          time_start: appointmentForm.time_start || null,
          time_end: appointmentForm.time_end || null,
          notes: appointmentForm.notes || null,
        })
        .eq("id", editingAppointment);

      if (error) {
        toast.error("Fehler beim Speichern");
      } else {
        toast.success("Termin aktualisiert");
      }
    }
    
    setEditingAppointment(null);
    loadData();
    setActionLoading(false);
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Termin wirklich löschen?")) return;
    
    const { error } = await supabase
      .from("partner_job_appointments")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Termin gelöscht");
      loadData();
    }
  }

  function startNewAppointment() {
    setAppointmentForm({
      title: '',
      date: '',
      time_start: '',
      time_end: '',
      notes: ''
    });
    setEditingAppointment('new');
  }

  function startEditAppointment(appt: any) {
    setAppointmentForm({
      title: appt.title,
      date: appt.date,
      time_start: appt.time_start?.slice(0, 5) || '',
      time_end: appt.time_end?.slice(0, 5) || '',
      notes: appt.notes || ''
    });
    setEditingAppointment(appt.id);
  }

  function openMaps() {
    if (!job?.project?.customer) return;
    const { address, postal_code, city } = job.project.customer;
    const query = encodeURIComponent(`${address}, ${postal_code} ${city}`);
    window.open(`https://maps.google.com/maps?q=${query}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!job) return null;

  const isOpen = job.status === "open";
  const isOwner = job.accepted_by_partner_id === partnerUser?.partner_id;
  const isAdmin = partnerUser?.role === "admin";
  const canAccept = isOpen && isAdmin;
  const canStart = job.status === "accepted" && isOwner;
  const canAccessDiary = ['accepted', 'in_progress', 'completed'].includes(job.status) && isOwner;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link 
        href="/partner/auftraege"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Liste
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{job.title}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-neutral-400 mt-1">
            {job.project?.name} · {job.trade && <span className="text-neutral-500">{getTradeLabel(job.trade)}</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canAccept && (
            <>
              <button
                onClick={acceptJob}
                disabled={actionLoading}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Annehmen
              </button>
              <button
                onClick={declineJob}
                disabled={actionLoading}
                className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
              >
                <XCircle className="w-4 h-4" />
                Ablehnen
              </button>
            </>
          )}
          {canStart && (
            <button
              onClick={startJob}
              disabled={actionLoading}
              className="btn-primary flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Starten
            </button>
          )}
          {canAccessDiary && (
            <Link
              href={`/partner/auftraege/${job.id}/rapport`}
              className="btn-secondary flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Tagebuch
            </Link>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          {job.description && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Beschreibung</h2>
              <p className="text-neutral-300 whitespace-pre-wrap">{job.description}</p>
            </div>
          )}

          {/* Deadline & Info */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#fa432a]" />
              Zu erledigen bis
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-white">
                {job.scheduled_date 
                  ? new Date(job.scheduled_date).toLocaleDateString('de-DE', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : "Kein Datum festgelegt"
                }
              </div>
            </div>
            {job.estimated_hours && (
              <p className="text-neutral-400 text-sm mt-2">
                Geschätzter Aufwand: ca. {job.estimated_hours} Stunden
              </p>
            )}
          </div>

          {/* Termine (alle Gewerke im Projekt) - direkt unter Deadline */}
          {job.status !== 'open' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#fa432a]" />
                  Termine
                </h2>
                {isOwner && job.status !== 'completed' && !editingAppointment && (
                  <button
                    onClick={startNewAppointment}
                    className="btn-secondary text-sm px-3 py-1.5"
                  >
                    + Termin hinzufügen
                  </button>
                )}
              </div>
              
              {editingAppointment ? (
                <div className="bg-[#111] rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Art des Termins *</label>
                      <select
                        value={appointmentForm.title}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
                        className="input w-full"
                      >
                        <option value="">Bitte wählen...</option>
                        <option value="Aufbau/Montage">Aufbau/Montage</option>
                        <option value="Nacharbeiten">Nacharbeiten</option>
                        <option value="Wartung">Wartung</option>
                        <option value="Reparatur">Reparatur</option>
                        <option value="Besichtigung">Besichtigung</option>
                        <option value="Abnahme">Abnahme</option>
                        <option value="Sonstiges">Sonstiges</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Datum *</label>
                      <input
                        type="date"
                        value={appointmentForm.date}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Von</label>
                      <input
                        type="time"
                        value={appointmentForm.time_start}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, time_start: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 block mb-1">Bis</label>
                      <input
                        type="time"
                        value={appointmentForm.time_end}
                        onChange={(e) => setAppointmentForm({ ...appointmentForm, time_end: e.target.value })}
                        className="input w-full"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="text-xs text-neutral-500 block mb-1">Notizen</label>
                    <input
                      type="text"
                      value={appointmentForm.notes}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, notes: e.target.value })}
                      placeholder="z.B. Absprache mit Kunde, Material bereitstellen..."
                      className="input w-full"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setEditingAppointment(null)}
                      className="btn-secondary"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={saveAppointment}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : appointments.length > 0 ? (
                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-800">
                        <th className="text-left text-xs text-neutral-500 uppercase pb-3 font-medium">Gewerk</th>
                        <th className="text-left text-xs text-neutral-500 uppercase pb-3 font-medium">Art</th>
                        <th className="text-left text-xs text-neutral-500 uppercase pb-3 font-medium">Datum</th>
                        <th className="text-left text-xs text-neutral-500 uppercase pb-3 font-medium hidden sm:table-cell">Uhrzeit</th>
                        <th className="text-left text-xs text-neutral-500 uppercase pb-3 font-medium hidden md:table-cell">Notizen</th>
                        {isOwner && job.status !== 'completed' && (
                          <th className="text-right text-xs text-neutral-500 uppercase pb-3 font-medium w-20">Aktionen</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map((appt) => {
                        const isOwnAppointment = appt.job_id === job.id;
                        return (
                          <tr key={appt.id} className={`border-b border-neutral-800/50 hover:bg-[#111] group ${!isOwnAppointment ? 'opacity-75' : ''}`}>
                            <td className="py-3">
                              <div>
                                <span className={`text-xs px-2 py-0.5 rounded ${isOwnAppointment ? 'bg-[#fa432a]/20 text-[#fa432a]' : 'bg-neutral-800 text-neutral-400'}`}>
                                  {getTradeLabel(appt.job?.trade)}
                                </span>
                                {appt.job?.partner?.company_name && (
                                  <p className="text-xs text-neutral-500 mt-1">{appt.job.partner.company_name}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="text-white font-medium">{appt.title}</span>
                            </td>
                            <td className="py-3">
                              <span className="text-neutral-300">
                                {new Date(appt.date).toLocaleDateString('de-DE', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </span>
                            </td>
                            <td className="py-3 hidden sm:table-cell">
                              <span className="text-neutral-300">
                                {appt.time_start ? appt.time_start.slice(0, 5) : '–'}
                                {appt.time_end && ` – ${appt.time_end.slice(0, 5)}`}
                              </span>
                            </td>
                            <td className="py-3 hidden md:table-cell">
                              <span className="text-neutral-400 text-sm">{appt.notes || '–'}</span>
                            </td>
                            {isOwner && job.status !== 'completed' && (
                              <td className="py-3 text-right">
                                {isOwnAppointment ? (
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => startEditAppointment(appt)}
                                      className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800"
                                      title="Bearbeiten"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => deleteAppointment(appt.id)}
                                      className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800"
                                      title="Löschen"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-neutral-600">–</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-neutral-400 mb-3">
                    Noch keine Termine eingetragen
                  </p>
                  {job.status !== 'completed' && (job.project?.customer?.mobile || job.project?.customer?.phone) && (
                    <a
                      href={`tel:${job.project.customer.mobile || job.project.customer.phone}`}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <Phone className="w-4 h-4" />
                      Kunde anrufen & Termin vereinbaren
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#fa432a]" />
                Dokumente
              </h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-[#111] rounded-lg hover:bg-[#1a1a1a] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-neutral-400" />
                      <div>
                        <p className="text-white text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-neutral-500">{doc.type}</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-neutral-500" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Team / Other Jobs */}
          {teamJobs.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#fa432a]" />
                Andere Gewerke im Projekt
              </h2>
              <div className="space-y-3">
                {teamJobs.map((tj) => (
                  <div key={tj.id} className="flex items-center justify-between p-3 bg-[#111] rounded-lg">
                    <div>
                      <p className="text-white text-sm font-medium">{tj.title}</p>
                      <p className="text-xs text-neutral-500">
                        {tj.partner?.company_name || "Noch offen"}
                        {tj.assigned_user && ` · ${tj.assigned_user.display_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <JobStatusBadge status={tj.status} />
                      {tj.scheduled_date && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {formatDate(tj.scheduled_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info - nur nach Annahme sichtbar */}
          {job.project?.customer && job.status === 'open' && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Standort</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin className="w-4 h-4" />
                  <span>{job.project.customer.postal_code} {job.project.customer.city}</span>
                </div>
                <p className="text-xs text-neutral-500 mt-3">
                  Vollständige Kundendaten werden nach Annahme des Auftrags sichtbar.
                </p>
              </div>
            </div>
          )}
          
          {job.project?.customer && isOwner && job.status !== 'open' && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Kunde</h2>
              <div className="space-y-3">
                <p className="text-white font-medium">{job.project.customer.first_name} {job.project.customer.last_name}</p>
                
                <div className="space-y-2 text-sm">
                  <button
                    onClick={openMaps}
                    className="flex items-start gap-2 text-neutral-400 hover:text-[#fa432a] transition-colors w-full text-left"
                  >
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {job.project.customer.street} {job.project.customer.house_number}<br />
                      {job.project.customer.postal_code} {job.project.customer.city}
                    </span>
                    <ExternalLink className="w-3 h-3 ml-auto mt-0.5" />
                  </button>
                  
                  {(job.project.customer.phone || job.project.customer.mobile) && (
                    <a
                      href={`tel:${job.project.customer.mobile || job.project.customer.phone}`}
                      className="flex items-center gap-2 text-neutral-400 hover:text-[#fa432a] transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {job.project.customer.mobile || job.project.customer.phone}
                    </a>
                  )}
                  
                  {job.project.customer.email && (
                    <a
                      href={`mailto:${job.project.customer.email}`}
                      className="flex items-center gap-2 text-neutral-400 hover:text-[#fa432a] transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      {job.project.customer.email}
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Assign to team member (Admin only) */}
          {isOwner && isAdmin && teamMembers.length > 0 && job.status !== 'open' && job.status !== 'completed' && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Zuweisung</h2>
              <select
                value={job.assigned_to_user_id || ""}
                onChange={(e) => assignToUser(e.target.value)}
                className="input w-full"
                disabled={actionLoading}
              >
                <option value="">Nicht zugewiesen</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name} {member.role === 'admin' && '(Admin)'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Chat Link */}
          {isOwner && (
            <Link
              href={`/partner/auftraege/${job.id}/chat`}
              className="card p-5 block hover:bg-[#1a1a1a] transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-[#fa432a]" />
                  <span className="font-medium text-white">Projekt-Chat</span>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-500" />
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    open: { label: "Verfügbar", class: "bg-yellow-500/20 text-yellow-400" },
    accepted: { label: "Angenommen", class: "bg-[#fa432a]/20 text-[#fa432a]" },
    in_progress: { label: "In Arbeit", class: "bg-orange-500/20 text-orange-400" },
    completed: { label: "Erledigt", class: "bg-green-500/20 text-green-400" },
    declined: { label: "Abgelehnt", class: "bg-red-500/20 text-red-400" },
  };

  const info = statusMap[status] || { label: status, class: "bg-neutral-500/20 text-neutral-400" };

  return (
    <span className={`text-xs px-2 py-1 rounded ${info.class}`}>
      {info.label}
    </span>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
