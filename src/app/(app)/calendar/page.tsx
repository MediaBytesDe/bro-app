"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Clock,
  X,
  FileText,
  Wrench,
} from "lucide-react";

type ViewMode = "day" | "week" | "month";

interface UnifiedAppointment {
  id: string;
  title: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  notes: string | null;
  type: 'internal' | 'partner';
  project_name: string | null;
  project_id: string | null;
  project_slug: string | null;
  customer_name: string | null;
  partner_name: string | null;
  partner_id: string | null;
  trade: string | null;
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<UnifiedAppointment[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; parent_id: string | null }[]>([]);
  const [partners, setPartners] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  
  // Filters
  const [projectFilter, setProjectFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "internal" | "partner">("");
  
  // Modal
  const [selectedAppointment, setSelectedAppointment] = useState<UnifiedAppointment | null>(null);

  const supabase = createClient();

  // Calculate date range based on view mode
  const getDateRange = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (viewMode === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === "week") {
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday start
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    
    return { start, end };
  };

  // Load trades only once on mount
  const [tradesLoaded, setTradesLoaded] = useState(false);
  
  useEffect(() => {
    loadTradesFromDB(supabase, true).then(() => setTradesLoaded(true));
  }, []);
  
  useEffect(() => {
    if (tradesLoaded) loadData();
  }, [currentDate, viewMode, tradesLoaded]);

  async function loadData() {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const { data: partnerAppts } = await supabase
        .from("partner_job_appointments")
        .select(`
          id, title, date, time_start, time_end, notes,
          job:partner_jobs!job_id (
            id, title, trade,
            project:projects!project_id (id, name, slug),
            partner:partners!accepted_by_partner_id (id, company_name),
            customer:projects!project_id (
              customer:customers!customer_id (first_name, last_name)
            )
          )
        `)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date", { ascending: true });

      const { data: internalAppts } = await supabase
        .from("appointments")
        .select(`
          id, title, start_time, end_time, description, location_address,
          project:projects (id, name, slug),
          customer:customers (first_name, last_name)
        `)
        .gte("start_time", start.toISOString())
        .lte("start_time", end.toISOString())
        .order("start_time", { ascending: true });

    const partnerList: UnifiedAppointment[] = (partnerAppts || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      time_start: a.time_start,
      time_end: a.time_end,
      notes: a.notes,
      type: 'partner' as const,
      project_name: a.job?.project?.name || null,
      project_id: a.job?.project?.id || null,
      project_slug: a.job?.project?.slug || null,
      customer_name: a.job?.customer?.customer 
        ? `${a.job.customer.customer.first_name} ${a.job.customer.customer.last_name}`
        : null,
      partner_name: a.job?.partner?.company_name || null,
      partner_id: a.job?.partner?.id || null,
      trade: a.job?.trade || null,
    }));

    const internalList: UnifiedAppointment[] = (internalAppts || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      date: new Date(a.start_time).toISOString().split('T')[0],
      time_start: new Date(a.start_time).toTimeString().slice(0, 5),
      time_end: a.end_time ? new Date(a.end_time).toTimeString().slice(0, 5) : null,
      notes: a.description,
      type: 'internal' as const,
      project_name: a.project?.name || null,
      project_id: a.project?.id || null,
      project_slug: a.project?.slug || null,
      customer_name: a.customer 
        ? `${a.customer.first_name} ${a.customer.last_name}`
        : null,
      partner_name: null,
      partner_id: null,
      trade: null,
    }));

    const allAppts = [...partnerList, ...internalList].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time_start || '').localeCompare(b.time_start || '');
    });

    setAppointments(allAppts);

    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, parent_id")
      .order("name");
    setProjects(projectsData || []);

    const { data: partnersData } = await supabase
        .from("partners")
        .select("id, company_name")
        .eq("active", true)
        .order("company_name");
      setPartners(partnersData || []);
    } catch (err) {
      console.error("Error loading calendar:", err);
    } finally {
      setLoading(false);
    }
  }

  function navigate(direction: number) {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  // Hierarchy filter
  const getMatchingProjectIds = (filterId: string): Set<string> => {
    const ids = new Set<string>();
    ids.add(filterId);
    projects.forEach((p) => {
      if (p.parent_id === filterId) ids.add(p.id);
    });
    return ids;
  };

  const filtered = appointments.filter((a) => {
    if (projectFilter) {
      const matchingIds = getMatchingProjectIds(projectFilter);
      if (!a.project_id || !matchingIds.has(a.project_id)) return false;
    }
    if (partnerFilter && a.partner_id !== partnerFilter) return false;
    if (typeFilter && a.type !== typeFilter) return false;
    return true;
  });

  const groupedByDate = filtered.reduce((acc, apt) => {
    if (!acc[apt.date]) acc[apt.date] = [];
    acc[apt.date].push(apt);
    return acc;
  }, {} as Record<string, UnifiedAppointment[]>);

  // Navigation label
  const getNavigationLabel = () => {
    if (viewMode === "day") {
      return currentDate.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    } else if (viewMode === "week") {
      const { start, end } = getDateRange();
      return `${start.toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return currentDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isToday = (dateStr: string) => dateStr === todayStr;

  // Week view helpers
  const getWeekDays = () => {
    const { start } = getDateRange();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Month view helpers  
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const days: (Date | null)[] = [];
    for (let i = 0; i < adjustedFirstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  // Appointment card component
  const AppointmentCard = ({ apt, compact = false }: { apt: UnifiedAppointment; compact?: boolean }) => (
    <div
      onClick={() => setSelectedAppointment(apt)}
      className={`${compact ? 'text-xs px-1.5 py-1' : 'p-3'} rounded-lg cursor-pointer transition-all hover:ring-1 hover:ring-neutral-700 ${
        apt.type === 'partner' ? "bg-[#fa432a]/10 hover:bg-[#fa432a]/15" : "bg-blue-500/10 hover:bg-blue-500/15"
      }`}
    >
      {compact ? (
        <div>
          <div className={`truncate font-medium ${apt.type === 'partner' ? 'text-[#fa432a]' : 'text-blue-400'}`}>
            {apt.time_start?.slice(0, 5)} {apt.title}
          </div>
          {apt.customer_name && (
            <div className="truncate text-neutral-500 text-[10px]">{apt.customer_name}</div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white text-sm truncate">{apt.title}</p>
              {apt.project_name && (
                <p className="text-xs text-neutral-400 truncate">{apt.project_name}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
              apt.type === 'partner' ? "bg-[#fa432a]/20 text-[#fa432a]" : "bg-blue-500/20 text-blue-400"
            }`}>
              {apt.type === 'partner' ? 'Partner' : 'Intern'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-neutral-400">
            {apt.time_start && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {apt.time_start.slice(0, 5)}{apt.time_end && ` – ${apt.time_end.slice(0, 5)}`}
              </span>
            )}
            {apt.partner_name && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {apt.partner_name}
              </span>
            )}
            {apt.customer_name && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {apt.customer_name}
              </span>
            )}
          </div>
          {apt.notes && <p className="text-xs text-neutral-500 mt-2 truncate">{apt.notes}</p>}
        </>
      )}
    </div>
  );

  // Detail Modal
  const AppointmentModal = () => {
    if (!selectedAppointment) return null;
    const apt = selectedAppointment;
    
    return (
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setSelectedAppointment(null)}
      >
        <div 
          className="bg-[#111] border border-neutral-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-4 border-b border-neutral-800 ${
            apt.type === 'partner' ? "bg-[#fa432a]/10" : "bg-blue-500/10"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  apt.type === 'partner' ? "bg-[#fa432a]/20 text-[#fa432a]" : "bg-blue-500/20 text-blue-400"
                }`}>
                  {apt.type === 'partner' ? 'Partner-Termin' : 'Interner Termin'}
                </span>
                <h2 className="text-xl font-semibold text-white mt-2">{apt.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedAppointment(null)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Date & Time */}
            <div className="flex items-center gap-3 text-neutral-300">
              <Calendar className="w-5 h-5 text-neutral-500" />
              <div>
                <p className="font-medium">
                  {new Date(apt.date).toLocaleDateString('de-DE', { 
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
                  })}
                </p>
                {apt.time_start && (
                  <p className="text-sm text-neutral-400">
                    {apt.time_start.slice(0, 5)} Uhr
                    {apt.time_end && ` – ${apt.time_end.slice(0, 5)} Uhr`}
                  </p>
                )}
              </div>
            </div>
            
            {/* Project */}
            {apt.project_name && (
              <div className="flex items-center gap-3 text-neutral-300">
                <FileText className="w-5 h-5 text-neutral-500" />
                <div>
                  <p className="text-sm text-neutral-500">Projekt</p>
                  {apt.project_slug ? (
                    <a 
                      href={`/projects/${apt.project_slug}`}
                      className="font-medium text-[#fa432a] hover:underline"
                    >
                      {apt.project_name}
                    </a>
                  ) : (
                    <p className="font-medium">{apt.project_name}</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Customer */}
            {apt.customer_name && (
              <div className="flex items-center gap-3 text-neutral-300">
                <User className="w-5 h-5 text-neutral-500" />
                <div>
                  <p className="text-sm text-neutral-500">Kunde</p>
                  <p className="font-medium">{apt.customer_name}</p>
                </div>
              </div>
            )}
            
            {/* Partner */}
            {apt.partner_name && (
              <div className="flex items-center gap-3 text-neutral-300">
                <Building2 className="w-5 h-5 text-neutral-500" />
                <div>
                  <p className="text-sm text-neutral-500">Partner</p>
                  <p className="font-medium">{apt.partner_name}</p>
                </div>
              </div>
            )}
            
            {/* Trade */}
            {apt.trade && (
              <div className="flex items-center gap-3 text-neutral-300">
                <Wrench className="w-5 h-5 text-neutral-500" />
                <div>
                  <p className="text-sm text-neutral-500">Gewerk</p>
                  <p className="font-medium">{getTradeLabel(apt.trade)}</p>
                </div>
              </div>
            )}
            
            {/* Notes */}
            {apt.notes && (
              <div className="pt-3 border-t border-neutral-800">
                <p className="text-sm text-neutral-500 mb-1">Notizen</p>
                <p className="text-neutral-300 whitespace-pre-wrap">{apt.notes}</p>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-neutral-800 flex justify-end">
            <button 
              onClick={() => setSelectedAppointment(null)}
              className="btn-secondary px-4 py-2"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Detail Modal */}
      <AppointmentModal />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-[#fa432a]" />
            Kalender
          </h1>
          <p className="text-neutral-400 mt-1 text-sm">{filtered.length} Termine</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-2 text-sm">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-700"
          >
            <option value="">Projekt</option>
            {projects.filter(p => !p.parent_id).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {projects.filter(p => p.parent_id).map((p) => (
              <option key={p.id} value={p.id}>{"  "}- {p.name}</option>
            ))}
          </select>
          <select
            value={partnerFilter}
            onChange={(e) => setPartnerFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-700"
          >
            <option value="">Partner</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.company_name}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-neutral-700"
          >
            <option value="">Typ</option>
            <option value="internal">Intern</option>
            <option value="partner">Partner</option>
          </select>
          {(projectFilter || partnerFilter || typeFilter) && (
            <button
              onClick={() => { setProjectFilter(""); setPartnerFilter(""); setTypeFilter(""); }}
              className="text-neutral-500 hover:text-white px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Navigation & View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn-secondary p-2">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => navigate(1)} className="btn-secondary p-2">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={goToToday} className="btn-secondary px-3 py-1.5 text-sm">
            Heute
          </button>
          <span className="text-white font-medium ml-2">{getNavigationLabel()}</span>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
          {(["day", "week", "month"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === mode
                  ? "bg-[#fa432a] text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {mode === "day" ? "Tag" : mode === "week" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Day View */}
          {viewMode === "day" && (
            <div className="card p-4">
              <div className="space-y-3">
                {filtered.length === 0 ? (
                  <p className="text-neutral-500 text-center py-12">Keine Termine an diesem Tag</p>
                ) : (
                  filtered.map((apt) => <AppointmentCard key={apt.id} apt={apt} />)
                )}
              </div>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="card overflow-hidden">
              <div className="grid grid-cols-7 border-b border-neutral-800">
                {getWeekDays().map((day) => {
                  const dateStr = day.toISOString().split('T')[0];
                  return (
                    <div
                      key={dateStr}
                      className={`p-2 text-center border-r border-neutral-800 last:border-r-0 ${
                        isToday(dateStr) ? "bg-[#fa432a]/10" : ""
                      }`}
                    >
                      <div className="text-xs text-neutral-500">
                        {day.toLocaleDateString("de-DE", { weekday: "short" })}
                      </div>
                      <div className={`text-lg font-medium ${isToday(dateStr) ? "text-[#fa432a]" : "text-white"}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {getWeekDays().map((day) => {
                  const dateStr = day.toISOString().split('T')[0];
                  const dayAppts = groupedByDate[dateStr] || [];
                  return (
                    <div
                      key={dateStr}
                      className={`p-2 border-r border-neutral-800 last:border-r-0 ${
                        isToday(dateStr) ? "bg-[#fa432a]/5" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        {dayAppts.map((apt) => (
                          <AppointmentCard key={apt.id} apt={apt} compact />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month View */}
          {viewMode === "month" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 card overflow-hidden">
                <div className="grid grid-cols-7 border-b border-neutral-800 bg-[#0a0a0a]">
                  {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                    <div key={d} className="p-2 text-center text-xs font-medium text-neutral-500">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {getMonthDays().map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="p-2 min-h-[80px] bg-[#0a0a0a] border-b border-r border-neutral-800/50" />;
                    }
                    const dateStr = day.toISOString().split('T')[0];
                    const dayAppts = groupedByDate[dateStr] || [];
                    return (
                      <div
                        key={dateStr}
                        className={`p-2 min-h-[80px] border-b border-r border-neutral-800/50 ${
                          isToday(dateStr) ? "bg-[#fa432a]/10" : dayAppts.length > 0 ? "bg-[#111]" : ""
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${isToday(dateStr) ? "text-[#fa432a]" : "text-neutral-400"}`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayAppts.slice(0, 3).map((apt) => (
                            <AppointmentCard key={apt.id} apt={apt} compact />
                          ))}
                          {dayAppts.length > 3 && (
                            <div className="text-xs text-neutral-500">+{dayAppts.length - 3} mehr</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side list */}
              <div className="card p-4 h-fit max-h-[600px] overflow-y-auto">
                <h3 className="font-semibold text-white mb-4">Termine</h3>
                {Object.keys(groupedByDate).length === 0 ? (
                  <p className="text-neutral-500 text-center py-8">Keine Termine</p>
                ) : (
                  <div className="space-y-4">
                    {Object.keys(groupedByDate).sort().map((date) => (
                      <div key={date}>
                        <div className="text-xs text-neutral-500 uppercase mb-2">
                          {new Date(date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </div>
                        <div className="space-y-2">
                          {groupedByDate[date].map((apt) => <AppointmentCard key={apt.id} apt={apt} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
