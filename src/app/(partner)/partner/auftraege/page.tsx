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
  assigned_to_user_id: string;
  project: {
    id: string;
    name: string;
    customer: {
      first_name: string;
      last_name: string;
      street: string;
      house_number: string;
      postal_code: string;
      city: string;
    };
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
    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);
      
      const { data: { user } } = await supabase.auth.getUser();
      console.log("[Jobs] user:", user?.id);
      if (!user) { setLoading(false); return; }

      const { data: pu, error: puError } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      console.log("[Jobs] partnerUser:", pu, "error:", puError);
      if (!pu) { setLoading(false); return; }
      setPartnerUser(pu);

    const partnerId = pu.partner_id;
    const isAdmin = pu.role === 'admin';
    console.log("[Jobs] partnerId:", partnerId, "isAdmin:", isAdmin);

    let query = supabase
      .from("partner_jobs")
      .select(`
        *,
        project:projects (
          id, name,
          customer:customers (first_name, last_name, street, house_number, postal_code, city)
        )
      `)
      .order("scheduled_date", { ascending: true, nullsFirst: false });

    if (!isAdmin) {
      // Workers only see their assigned jobs
      query = query.eq("assigned_to_user_id", pu.id);
    } else {
      // Admin sees open pool + their partner's jobs
      query = query.or(`status.eq.open,accepted_by_partner_id.eq.${partnerId}`);
    }

    const { data, error: jobsError } = await query;
    console.log("[Jobs] jobs:", data?.length, "error:", jobsError);
    
    // Filter offene Jobs nach Partner-Gewerken
      const partnerTrades = pu.partner?.trades || [];
      const filteredData = (data || []).filter(job => {
        // Eigene Jobs immer zeigen
        if (job.accepted_by_partner_id === partnerId) return true;
        // Offene Jobs nur wenn Gewerk passt (oder kein Gewerk gesetzt)
        if (job.status === 'open') {
          if (!job.trade) return true; // Kein Gewerk = für alle
          return partnerTrades.includes(job.trade);
        }
        return true;
      });
      
      setJobs(filteredData);
    } catch (err) {
      console.error("Error loading jobs:", err);
    } finally {
      setLoading(false);
    }
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
            <ClipboardList className="w-7 h-7 text-[#fa432a]" />
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
                ? 'bg-[#fa432a] text-white'
                : 'bg-[#111] text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                filter === f.key ? 'bg-[#fa432a]' : 'bg-[#222]'
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
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Status</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Auftrag</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">Kunde / Ort</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">Projekt</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden sm:table-cell">Termin</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">Gewerk</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr 
                  key={job.id}
                  className={`border-b border-neutral-800/50 hover:bg-[#111] transition-colors cursor-pointer ${
                    job.status === 'open' ? 'border-l-2 border-l-yellow-500' : ''
                  }`}
                  onClick={() => window.location.href = `/partner/auftraege/${job.id}`}
                >
                  <td className="py-3 px-4">
                    <JobStatusBadge status={job.status} />
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-white">{job.title}</span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-neutral-300">
                      {job.status === 'open' 
                        ? `${job.project?.customer?.postal_code} ${job.project?.customer?.city}`
                        : `${job.project?.customer?.first_name} ${job.project?.customer?.last_name}`
                      }
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell">
                    <span className="text-neutral-400 text-sm">{job.project?.name}</span>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell">
                    {job.scheduled_date ? (
                      <span className="text-neutral-300 text-sm flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                        {formatDate(job.scheduled_date)}
                      </span>
                    ) : (
                      <span className="text-neutral-500 text-sm">–</span>
                    )}
                  </td>
                  <td className="py-3 px-4 hidden xl:table-cell">
                    {job.trade && (
                      <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                        {getTradeLabel(job.trade)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
