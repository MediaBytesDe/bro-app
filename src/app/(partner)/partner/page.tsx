"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Calendar,
  MapPin
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTradeLabel } from "@/lib/trades";

interface Job {
  id: string;
  title: string;
  description: string;
  trade: string;
  scheduled_date: string;
  scheduled_time_start: string;
  status: string;
  project: {
    name: string;
    customer: {
      first_name: string;
      last_name: string;
      city: string;
      postal_code: string;
    };
  };
}

interface Stats {
  open: number;
  accepted: number;
  inProgress: number;
  completed: number;
}

export default function PartnerDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [stats, setStats] = useState<Stats>({ open: 0, accepted: 0, inProgress: 0, completed: 0 });
  const [upcomingJobs, setUpcomingJobs] = useState<Job[]>([]);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Get partner user
      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) {
        setLoading(false);
        return;
      }
      setPartnerUser(pu);

    const partnerId = pu.partner_id;
    const isAdmin = pu.role === 'admin';

    // Load jobs
    let jobsQuery = supabase
      .from("partner_jobs")
      .select(`
        id, title, description, trade, scheduled_date, scheduled_time_start, status,
        project:projects (
          name,
          customer:customers (first_name, last_name, city, postal_code)
        )
      `)
      .order("scheduled_date", { ascending: true });

    // Workers only see assigned jobs
    if (!isAdmin) {
      jobsQuery = jobsQuery.eq("assigned_to_user_id", pu.id);
    } else {
      // Admin sees all jobs for their partner + open pool
      jobsQuery = jobsQuery.or(`status.eq.open,accepted_by_partner_id.eq.${partnerId}`);
    }

    const { data: jobs } = await jobsQuery;

    if (jobs) {
      // Filter offene Jobs nach Partner-Gewerken
      const partnerTrades = pu.partner?.trades || [];
      const relevantOpenJobs = jobs.filter(j => {
        if (j.status !== 'open') return false;
        if (!j.trade) return true; // Kein Gewerk = für alle
        return partnerTrades.includes(j.trade);
      });
      
      const partnerJobs = jobs.filter(j => j.status !== 'open');
      
      // Calculate stats
      setStats({
        open: relevantOpenJobs.length,
        accepted: partnerJobs.filter(j => j.status === 'accepted').length,
        inProgress: partnerJobs.filter(j => j.status === 'in_progress').length,
        completed: partnerJobs.filter(j => j.status === 'completed').length,
      });

      // Upcoming jobs (next 7 days, accepted or in_progress)
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      setUpcomingJobs(
        partnerJobs
          .filter(j => 
            ['accepted', 'in_progress'].includes(j.status) &&
            j.scheduled_date &&
            new Date(j.scheduled_date) <= nextWeek
          )
          .slice(0, 5)
      );

      // Open jobs (pool) - gefiltert nach Gewerk
      setOpenJobs(relevantOpenJobs.slice(0, 5));
    }
    } catch (err) {
      console.error("Error loading dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hallo, {partnerUser?.display_name?.split(" ")[0] || "Partner"}!
        </h1>
        <p className="text-neutral-400 mt-1">
          Hier ist Ihre Auftragsübersicht.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={AlertCircle}
          label="Offen (Pool)"
          value={stats.open}
          color="yellow"
        />
        <StatCard
          icon={ClipboardList}
          label="Angenommen"
          value={stats.accepted}
          color="red"
        />
        <StatCard
          icon={Clock}
          label="In Arbeit"
          value={stats.inProgress}
          color="orange"
        />
        <StatCard
          icon={CheckCircle}
          label="Erledigt"
          value={stats.completed}
          color="green"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Jobs */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#fa432a]" />
              Anstehende Termine
            </h2>
            <Link href="/partner/auftraege?filter=upcoming" className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {upcomingJobs.length === 0 ? (
            <div className="card p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
              <p className="text-neutral-400">Keine anstehenden Termine</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/partner/auftraege/${job.id}`}
                  className="card p-4 block hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-white">{job.title}</h3>
                      <p className="text-sm text-neutral-400 mt-1">
                        {job.project?.customer?.first_name} {job.project?.customer?.last_name} · {job.project?.name}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(job.scheduled_date)}
                          {job.scheduled_time_start && ` · ${job.scheduled_time_start.slice(0, 5)}`}
                        </span>
                        {job.project?.customer?.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.project.customer.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <JobStatusBadge status={job.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Open Jobs (Pool) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              Neue Aufträge
            </h2>
            <Link href="/partner/auftraege?filter=open" className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {openJobs.length === 0 ? (
            <div className="card p-8 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
              <p className="text-neutral-400">Keine offenen Aufträge</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openJobs.map((job) => (
                <Link
                  key={job.id}
                  href={`/partner/auftraege/${job.id}`}
                  className="card p-4 block hover:bg-[#1a1a1a] transition-colors border-l-2 border-yellow-500"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{job.title}</h3>
                        {job.trade && (
                          <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                            {getTradeLabel(job.trade)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-neutral-400 mt-1">
                        {job.project?.customer?.postal_code} {job.project?.customer?.city || "Ostfriesland"}
                      </p>
                      {job.scheduled_date && (
                        <p className="text-xs text-neutral-500 mt-2">
                          Geplant: {formatDate(job.scheduled_date)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                      Verfügbar
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { 
  icon: any; 
  label: string; 
  value: number; 
  color: string;
}) {
  const colors: Record<string, string> = {
    yellow: "from-yellow-500/20 to-orange-500/20 text-yellow-400",
    red: "from-[#fa432a]/20 to-orange-500/20 text-[#fa432a]",
    orange: "from-orange-500/20 to-red-500/20 text-orange-400",
    green: "from-green-500/20 to-emerald-500/20 text-green-400",
  };

  return (
    <div className={`card p-4 bg-gradient-to-br ${colors[color]}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    open: { label: "Offen", class: "bg-yellow-500/20 text-yellow-400" },
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
