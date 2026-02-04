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
  project: {
    id: string;
    name: string;
    slug: string;
    size_kwp: number;
    modules_count: number;
    module_type: string;
    inverter_type: string;
    battery_type: string;
    roof_type: string;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string;
      address: string;
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

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get partner user
    const { data: pu } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!pu) return;
    setPartnerUser(pu);

    // Get job details
    const { data: jobData, error } = await supabase
      .from("partner_jobs")
      .select(`
        *,
        project:projects (
          id, name, slug, size_kwp, modules_count, module_type, 
          inverter_type, battery_type, roof_type,
          customer:customers (
            id, name, email, phone, address, city, postal_code
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

    setLoading(false);
  }

  async function acceptJob() {
    if (!job || !partnerUser) return;
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
      toast.success("Auftrag angenommen!");
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
  const canWriteReport = job.status === "in_progress" && isOwner;

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
            {job.project?.name} · {job.trade && <span className="text-neutral-500">{job.trade}</span>}
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
          {canWriteReport && (
            <Link
              href={`/partner/auftraege/${job.id}/rapport`}
              className="btn-primary flex items-center gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Rapport schreiben
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

          {/* Schedule */}
          <div className="card p-5">
            <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Termin
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500 uppercase">Datum</p>
                <p className="text-white font-medium">
                  {job.scheduled_date ? formatDate(job.scheduled_date) : "Noch nicht geplant"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase">Uhrzeit</p>
                <p className="text-white font-medium">
                  {job.scheduled_time_start 
                    ? `${job.scheduled_time_start.slice(0, 5)}${job.scheduled_time_end ? ` - ${job.scheduled_time_end.slice(0, 5)}` : ''}`
                    : "–"
                  }
                </p>
              </div>
              {job.estimated_hours && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Geschätzte Dauer</p>
                  <p className="text-white font-medium">{job.estimated_hours} Stunden</p>
                </div>
              )}
            </div>
          </div>

          {/* Project Details */}
          {job.project && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Anlage</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                {job.project.size_kwp && (
                  <div>
                    <p className="text-neutral-500">Größe</p>
                    <p className="text-white font-medium">{job.project.size_kwp} kWp</p>
                  </div>
                )}
                {job.project.modules_count && (
                  <div>
                    <p className="text-neutral-500">Module</p>
                    <p className="text-white font-medium">{job.project.modules_count} Stück</p>
                  </div>
                )}
                {job.project.module_type && (
                  <div>
                    <p className="text-neutral-500">Modultyp</p>
                    <p className="text-white font-medium">{job.project.module_type}</p>
                  </div>
                )}
                {job.project.inverter_type && (
                  <div>
                    <p className="text-neutral-500">Wechselrichter</p>
                    <p className="text-white font-medium">{job.project.inverter_type}</p>
                  </div>
                )}
                {job.project.battery_type && (
                  <div>
                    <p className="text-neutral-500">Speicher</p>
                    <p className="text-white font-medium">{job.project.battery_type}</p>
                  </div>
                )}
                {job.project.roof_type && (
                  <div>
                    <p className="text-neutral-500">Dachtyp</p>
                    <p className="text-white font-medium">{job.project.roof_type}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
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
                <Users className="w-5 h-5 text-blue-400" />
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
          {/* Customer Info */}
          {job.project?.customer && isOwner && (
            <div className="card p-5">
              <h2 className="font-semibold text-white mb-3">Kunde</h2>
              <div className="space-y-3">
                <p className="text-white font-medium">{job.project.customer.name}</p>
                
                <div className="space-y-2 text-sm">
                  <button
                    onClick={openMaps}
                    className="flex items-start gap-2 text-neutral-400 hover:text-blue-400 transition-colors w-full text-left"
                  >
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {job.project.customer.address}<br />
                      {job.project.customer.postal_code} {job.project.customer.city}
                    </span>
                    <ExternalLink className="w-3 h-3 ml-auto mt-0.5" />
                  </button>
                  
                  {job.project.customer.phone && (
                    <a
                      href={`tel:${job.project.customer.phone}`}
                      className="flex items-center gap-2 text-neutral-400 hover:text-blue-400 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      {job.project.customer.phone}
                    </a>
                  )}
                  
                  {job.project.customer.email && (
                    <a
                      href={`mailto:${job.project.customer.email}`}
                      className="flex items-center gap-2 text-neutral-400 hover:text-blue-400 transition-colors"
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
                  <MessageSquare className="w-5 h-5 text-blue-400" />
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
    accepted: { label: "Angenommen", class: "bg-blue-500/20 text-blue-400" },
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
