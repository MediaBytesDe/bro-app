"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { 
  ClipboardList, 
  Calendar, 
  MapPin, 
  Filter,
  ChevronRight
} from "lucide-react";
import { formatDate } from "@/lib/utils";

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
  assigned_to_user_id: string;
  project: {
    id: string;
    name: string;
    customer: {
      name: string;
      city: string;
      address: string;
    };
  };
  assigned_user?: {
    display_name: string;
  };
}

type FilterType = 'all' | 'open' | 'mine' | 'upcoming' | 'completed';

export default function JobsListPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [partnerUser, setPartnerUser] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pu } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!pu) return;
    setPartnerUser(pu);

    const partnerId = pu.partner_id;
    const isAdmin = pu.role === 'admin';

    let query = supabase
      .from("partner_jobs")
      .select(`
        *,
        project:projects (
          id, name,
          customer:customers (name, city, address)
        ),
        assigned_user:partner_users!assigned_to_user_id (display_name)
      `)
      .order("scheduled_date", { ascending: true, nullsFirst: false });

    if (!isAdmin) {
      // Workers only see their assigned jobs
      query = query.eq("assigned_to_user_id", pu.id);
    } else {
      // Admin sees open pool + their partner's jobs
      query = query.or(`status.eq.open,accepted_by_partner_id.eq.${partnerId}`);
    }

    const { data } = await query;
    setJobs(data || []);
    setLoading(false);
  }

  const filteredJobs = jobs.filter(job => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const jobDate = job.scheduled_date ? new Date(job.scheduled_date) : null;
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    switch (filter) {
      case 'open':
        return job.status === 'open';
      case 'mine':
        return job.status !== 'open' && job.status !== 'completed';
      case 'upcoming':
        return ['accepted', 'in_progress'].includes(job.status) && jobDate && jobDate <= nextWeek;
      case 'completed':
        return job.status === 'completed';
      default:
        return true;
    }
  });

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Alle', count: jobs.length },
    { key: 'open', label: 'Verfügbar', count: jobs.filter(j => j.status === 'open').length },
    { key: 'mine', label: 'Meine', count: jobs.filter(j => j.status !== 'open' && j.status !== 'completed').length },
    { key: 'completed', label: 'Erledigt', count: jobs.filter(j => j.status === 'completed').length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-blue-400" />
            Aufträge
          </h1>
          <p className="text-neutral-400 mt-1">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'Auftrag' : 'Aufträge'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? 'bg-blue-500 text-white'
                : 'bg-[#111] text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                filter === f.key ? 'bg-blue-600' : 'bg-[#222]'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      {filteredJobs.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Aufträge gefunden</p>
          <p className="text-neutral-500 text-sm mt-1">
            {filter === 'open' 
              ? 'Aktuell keine neuen Aufträge im Pool' 
              : 'Ändern Sie den Filter um andere Aufträge zu sehen'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/partner/auftraege/${job.id}`}
              className={`card p-4 block hover:bg-[#1a1a1a] transition-colors ${
                job.status === 'open' ? 'border-l-2 border-yellow-500' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-white truncate">{job.title}</h3>
                    <JobStatusBadge status={job.status} />
                    {job.trade && (
                      <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded hidden sm:inline">
                        {job.trade}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-neutral-400 mt-1 truncate">
                    {job.project?.customer?.name} · {job.project?.name}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                    {job.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(job.scheduled_date)}
                        {job.scheduled_time_start && ` · ${job.scheduled_time_start.slice(0, 5)}`}
                      </span>
                    )}
                    {job.project?.customer?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {job.project.customer.city}
                      </span>
                    )}
                    {job.estimated_hours && (
                      <span>~{job.estimated_hours}h</span>
                    )}
                    {job.assigned_user?.display_name && (
                      <span className="text-blue-400">
                        → {job.assigned_user.display_name}
                      </span>
                    )}
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-neutral-600 ml-4" />
              </div>
            </Link>
          ))}
        </div>
      )}
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
