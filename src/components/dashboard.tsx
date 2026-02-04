"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { 
  Calendar, Clock, CheckCircle, Users, ChevronRight, 
  Zap, FileSignature, MapPin, Phone, AlertCircle,
  ArrowRight, Circle, Building2, Plus, TrendingUp
} from "lucide-react";
import type { AppointmentRow, TaskRow, LeadRow, ProjectStats } from "@/types/database";

interface QuoteItem {
  id: string;
  title: string;
  quote_number: string | null;
  status: string;
  total_amount: number;
  quote_date: string;
  customer?: { first_name: string; last_name: string; company_name?: string } | null;
}

interface DashboardData {
  todayAppointments: (AppointmentRow & { customer?: { first_name: string; last_name: string; company_name?: string } })[];
  upcomingAppointments: (AppointmentRow & { customer?: { first_name: string; last_name: string; company_name?: string } })[];
  myTasks: TaskRow[];
  openTasks: TaskRow[];
  newLeads: LeadRow[];
  projects: ProjectStats[];
  openQuotes: QuoteItem[];
  stats: {
    leadsCount: number;
    quotesCount: number;
    customersCount: number;
    appointmentsThisWeek: number;
  };
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [profile?.id]);

  async function loadData() {
    if (!profile?.id) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

      const [
        todayAppointmentsRes,
        upcomingAppointmentsRes,
        myTasksRes,
        openTasksRes,
        myProjectTasksRes,
        leadsRes,
        projectsRes,
        openQuotesRes,
        leadsCountRes,
        quotesCountRes,
        customersCountRes,
        weekAppointmentsRes,
      ] = await Promise.all([
        // Heutige Termine
        supabase
          .from("appointments")
          .select("*, customer:customers(first_name, last_name, company_name)")
          .gte("start_time", startOfDay)
          .lte("start_time", endOfDay)
          .not("status", "eq", "cancelled")
          .order("start_time"),
        
        // Kommende Termine (nächste 7 Tage, ohne heute)
        supabase
          .from("appointments")
          .select("*, customer:customers(first_name, last_name, company_name)")
          .gt("start_time", endOfDay)
          .lte("start_time", endOfWeek)
          .not("status", "eq", "cancelled")
          .order("start_time")
          .limit(5),
        
        // Meine offenen Aufgaben
        supabase
          .from("tasks")
          .select("*")
          .eq("assigned_to", profile.id)
          .in("status", ["open", "in_progress"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8),
        
        // Allgemeine offene Aufgaben
        supabase
          .from("tasks")
          .select("*")
          .is("assigned_to", null)
          .in("status", ["open", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(5),
        
        // Meine Projekt-Aufgaben
        supabase
          .from("project_tasks")
          .select("*, project:projects(id, name, slug)")
          .eq("assigned_user_id", profile.id)
          .in("status", ["open", "in_progress"])
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(8),
        
        // Neue Leads
        supabase
          .from("leads")
          .select("*")
          .in("status", ["new", "contacted", "qualified"])
          .order("created_at", { ascending: false })
          .limit(8),
        
        // Projekte/Marken
        supabase
          .from("projects")
          .select("*")
          .is("parent_id", null)
          .order("sort_order")
          .limit(6),
        
        // Offene Angebote (nicht abgeschlossen)
        supabase
          .from("wawi_quotes")
          .select("id, title, quote_number, status, total_amount, quote_date, customer:customers(first_name, last_name, company_name)")
          .not("status", "in", '("accepted","rejected","expired")')
          .order("created_at", { ascending: false })
          .limit(10),
        
        // Stats
        supabase.from("leads").select("*", { count: "exact", head: true }).not("status", "in", '("won","lost")'),
        supabase.from("wawi_quotes").select("*", { count: "exact", head: true }).not("status", "in", '("accepted","rejected","expired")'),
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase.from("appointments").select("*", { count: "exact", head: true }).gte("start_time", startOfDay).lte("start_time", endOfWeek),
      ]);

      // Combine old tasks and project tasks
      const combinedTasks = [
        ...(myTasksRes.data || []).map(t => ({ ...t, _source: "tasks" })),
        ...(myProjectTasksRes.data || []).map(t => ({ ...t, _source: "project_tasks" })),
      ].sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }).slice(0, 8);

      setData({
        todayAppointments: todayAppointmentsRes.data || [],
        upcomingAppointments: upcomingAppointmentsRes.data || [],
        myTasks: combinedTasks,
        openTasks: openTasksRes.data || [],
        newLeads: leadsRes.data || [],
        projects: (projectsRes.data || []).map(p => ({ ...p, total_tasks: 0, open_tasks: 0, in_progress_tasks: 0, done_tasks: 0 })),
        openQuotes: openQuotesRes.data || [],
        stats: {
          leadsCount: leadsCountRes.count || 0,
          quotesCount: quotesCountRes.count || 0,
          customersCount: customersCountRes.count || 0,
          appointmentsThisWeek: weekAppointmentsRes.count || 0,
        },
      });
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
    setLoading(false);
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Guten Morgen";
    if (hour < 18) return "Guten Tag";
    return "Guten Abend";
  };

  const formatDate = () => {
    return new Date().toLocaleDateString("de-DE", { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <p className="text-neutral-500 text-sm">{formatDate()}</p>
          <h1 className="text-2xl font-bold text-white mt-1">
            {getGreeting()}, {profile?.display_name?.split(" ")[0] || "👋"}
          </h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => router.push("/quotes/new")}
            className="flex items-center gap-2 px-4 py-2 bg-[#fa432a] text-white rounded-xl text-sm font-medium hover:bg-[#e03d26] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Angebot
          </button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          value={data.stats.appointmentsThisWeek} 
          label="Termine diese Woche" 
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
          onClick={() => router.push("/calendar")}
        />
        <StatCard 
          value={data.stats.leadsCount} 
          label="Offene Leads" 
          icon={<Zap className="w-5 h-5" />}
          color="purple"
          onClick={() => router.push("/leads")}
        />
        <QuotesStatCard 
          quotes={data.openQuotes}
          total={data.stats.quotesCount}
        />
        <StatCard 
          value={data.stats.customersCount} 
          label="Kunden" 
          icon={<Building2 className="w-5 h-5" />}
          color="green"
          onClick={() => router.push("/customers")}
        />
      </div>

      {/* Main Grid - 2 Columns on Desktop */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Termine & Aufgaben */}
        <div className="space-y-6">
          {/* Heutige Termine */}
          <Section 
            title="Heute" 
            icon={<Calendar className="w-4 h-4" />}
            action={{ label: "Kalender", onClick: () => router.push("/calendar") }}
            badge={data.todayAppointments.length || undefined}
          >
            {data.todayAppointments.length > 0 ? (
              <div className="space-y-2">
                {data.todayAppointments.map((apt) => (
                  <AppointmentCard key={apt.id} appointment={apt} />
                ))}
              </div>
            ) : (
              <EmptyState message="Keine Termine heute" small />
            )}
          </Section>

          {/* Kommende Termine */}
          {data.upcomingAppointments.length > 0 && (
            <Section 
              title="Kommende Termine" 
              icon={<Clock className="w-4 h-4" />}
            >
              <div className="space-y-2">
                {data.upcomingAppointments.map((apt) => (
                  <AppointmentCardCompact key={apt.id} appointment={apt} />
                ))}
              </div>
            </Section>
          )}

          {/* Meine Aufgaben */}
          <Section 
            title="Meine Aufgaben" 
            icon={<CheckCircle className="w-4 h-4" />}
            badge={data.myTasks.length || undefined}
          >
            {data.myTasks.length > 0 ? (
              <div className="space-y-1.5">
                {data.myTasks.map((task) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={() => {
                      if (task._source === "project_tasks" && task.project?.slug) {
                        router.push(`/projects/${task.project.slug}?tab=tasks`);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="Keine offenen Aufgaben" small />
            )}
          </Section>

          {/* Offene Aufgaben */}
          {data.openTasks.length > 0 && (
            <Section 
              title="Nicht zugewiesen" 
              icon={<AlertCircle className="w-4 h-4" />}
              subtle
            >
              <div className="space-y-1.5">
                {data.openTasks.map((task) => (
                  <TaskCard key={task.id} task={task} compact />
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Right Column - Leads & Arbeitsbereiche */}
        <div className="space-y-6">
          {/* Leads */}
          <Section 
            title="Leads" 
            icon={<Users className="w-4 h-4" />}
            action={{ label: "Alle", onClick: () => router.push("/leads") }}
            badge={data.newLeads.length || undefined}
          >
            {data.newLeads.length > 0 ? (
              <div className="space-y-2">
                {data.newLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} onClick={() => router.push(`/leads/${lead.id}`)} />
                ))}
              </div>
            ) : (
              <EmptyState message="Keine offenen Leads" small />
            )}
          </Section>

          {/* Arbeitsbereiche */}
          {data.projects.length > 0 && (
            <Section 
              title="Arbeitsbereiche" 
              icon={<TrendingUp className="w-4 h-4" />}
            >
              <div className="grid grid-cols-2 gap-2">
                {data.projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => router.push(`/projects/${project.slug}`)}
                    className="flex items-center gap-3 p-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl hover:border-[#262626] transition-all text-left"
                  >
                    {(project as any).logo_url ? (
                      <img 
                        src={(project as any).logo_url} 
                        alt={project.name}
                        className="w-8 h-8 rounded-lg object-contain bg-white/5"
                      />
                    ) : (
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                        style={{ backgroundColor: project.color || "#f97316" }}
                      >
                        {project.name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-sm text-white truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card
function StatCard({ value, label, icon, color, onClick }: { 
  value: number; 
  label: string; 
  icon: React.ReactNode;
  color: "orange" | "blue" | "green" | "purple";
  onClick?: () => void;
}) {
  const colors = {
    orange: "border-[#fa432a]/20 hover:border-[#fa432a]/40",
    blue: "border-blue-500/20 hover:border-blue-500/40",
    green: "border-green-500/20 hover:border-green-500/40",
    purple: "border-purple-500/20 hover:border-purple-500/40",
  };
  
  const iconColors = {
    orange: "text-[#fa432a]",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 bg-[#111] border ${colors[color]} rounded-xl transition-all text-left hover:bg-[#151515]`}
    >
      <div className={`mb-2 ${iconColors[color]}`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
    </button>
  );
}

// Quotes Stat Card (expandable)
function QuotesStatCard({ quotes, total }: { quotes: QuoteItem[]; total: number }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const statusGroups = [
    { key: "draft", label: "Entwürfe", color: "text-neutral-400" },
    { key: "sent_to_lexware", label: "An Lexware", color: "text-blue-400" },
    { key: "sent", label: "Versendet", color: "text-cyan-400" },
    { key: "open", label: "Offen", color: "text-yellow-400" },
  ];

  const groupedQuotes = statusGroups.map(g => ({
    ...g,
    items: quotes.filter(q => q.status === g.key)
  })).filter(g => g.items.length > 0);

  // Summary line
  const summary = groupedQuotes.map(g => `${g.items.length} ${g.label}`).join(" · ");

  return (
    <div className={`bg-[#111] border border-[#fa432a]/20 rounded-xl transition-all ${expanded ? "col-span-2 md:col-span-4" : ""}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-[#151515] rounded-xl transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#fa432a] mb-2">
              <FileSignature className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-white">{total}</div>
            <div className="text-xs text-neutral-500 mt-0.5">Offene Angebote</div>
          </div>
          {!expanded && total > 0 && (
            <ChevronRight className={`w-5 h-5 text-neutral-500 transition-transform ${expanded ? "rotate-90" : ""}`} />
          )}
        </div>
        {!expanded && total > 0 && (
          <div className="text-[10px] text-neutral-500 mt-2 truncate">{summary}</div>
        )}
      </button>

      {expanded && quotes.length > 0 && (
        <div className="px-4 pb-4 space-y-3">
          {groupedQuotes.map((group) => (
            <div key={group.key}>
              <div className={`text-[10px] uppercase tracking-wide mb-1.5 ${group.color}`}>
                {group.label} ({group.items.length})
              </div>
              <div className="space-y-1">
                {group.items.map((quote) => {
                  const customerName = quote.customer 
                    ? (quote.customer.company_name || `${quote.customer.first_name || ""} ${quote.customer.last_name || ""}`.trim())
                    : null;
                  const amount = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount || 0);
                  
                  return (
                    <button
                      key={quote.id}
                      onClick={(e) => { e.stopPropagation(); router.push(`/quotes/${quote.id}`); }}
                      className="w-full flex items-center gap-3 p-2 bg-[#0d0d0d] rounded-lg hover:bg-[#151515] transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{quote.title || "Angebot"}</div>
                        <div className="text-[10px] text-neutral-500">
                          {quote.quote_number || `#${quote.id.slice(0, 6)}`}
                          {customerName && ` · ${customerName}`}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-white">{amount}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); router.push("/quotes"); }}
            className="w-full text-center text-xs text-[#fa432a] hover:underline py-2"
          >
            Alle Angebote →
          </button>
        </div>
      )}
    </div>
  );
}

// Section
function Section({ 
  title, 
  icon, 
  action, 
  badge,
  subtle,
  children 
}: { 
  title: string; 
  icon: React.ReactNode;
  action?: { label: string; onClick: () => void };
  badge?: number;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`p-4 rounded-2xl ${subtle ? "bg-[#0a0a0a] border border-[#141414]" : "bg-[#111] border border-[#1a1a1a]"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={subtle ? "text-neutral-600" : "text-neutral-500"}>{icon}</span>
          <h2 className={`font-semibold ${subtle ? "text-neutral-400" : "text-white"}`}>{title}</h2>
          {badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#fa432a]/10 text-[#fa432a] rounded">
              {badge}
            </span>
          )}
        </div>
        {action && (
          <button 
            onClick={action.onClick}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-[#fa432a] transition-colors"
          >
            {action.label}
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// Appointment Card
function AppointmentCard({ appointment }: { 
  appointment: AppointmentRow & { customer?: { first_name: string; last_name: string; company_name?: string } } 
}) {
  const time = new Date(appointment.start_time).toLocaleTimeString("de-DE", { 
    hour: "2-digit", 
    minute: "2-digit" 
  });
  
  const customerName = appointment.customer 
    ? (appointment.customer.company_name || `${appointment.customer.first_name} ${appointment.customer.last_name}`)
    : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-xl">
      <div className="text-center min-w-[44px] px-2 py-1 bg-blue-500/10 rounded-lg">
        <div className="text-sm font-bold text-blue-400">{time}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">{appointment.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
          {customerName && (
            <span className="flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3" />
              {customerName}
            </span>
          )}
          {appointment.location_address && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {appointment.location_address.split(",")[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Appointment Card Compact
function AppointmentCardCompact({ appointment }: { 
  appointment: AppointmentRow & { customer?: { first_name: string; last_name: string; company_name?: string } } 
}) {
  const date = new Date(appointment.start_time);
  const dayName = date.toLocaleDateString("de-DE", { weekday: "short" });
  const dayNum = date.getDate();
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#0d0d0d] transition-colors">
      <div className="text-center min-w-[36px]">
        <div className="text-[10px] text-neutral-500 uppercase">{dayName}</div>
        <div className="text-sm font-bold text-white">{dayNum}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{appointment.title}</div>
      </div>
      <div className="text-xs text-neutral-500">{time}</div>
    </div>
  );
}

// Task Card
function TaskCard({ task, compact, onClick }: { task: any; compact?: boolean; onClick?: () => void }) {
  const statusColors: Record<string, string> = {
    open: "bg-orange-500",
    in_progress: "bg-blue-500",
    blocked: "bg-red-500",
    done: "bg-green-500",
  };

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== "done";
  const projectName = task.project?.name;

  if (compact) {
    return (
      <button 
        onClick={onClick}
        className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${statusColors[task.status || "open"]}`} />
        <span className="text-sm text-neutral-400 truncate flex-1">{task.title}</span>
      </button>
    );
  }

  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2.5 bg-[#0d0d0d] rounded-lg hover:bg-[#121212] transition-colors text-left"
    >
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[task.status || "open"]}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{task.title}</div>
        {projectName && (
          <div className="text-[10px] text-neutral-500 truncate">{projectName}</div>
        )}
      </div>
      {dueDate && (
        <div className={`text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? "bg-red-500/10 text-red-400" : "text-neutral-500"}`}>
          {dueDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
        </div>
      )}
    </button>
  );
}

// Lead Card
function LeadCard({ lead, onClick }: { lead: LeadRow; onClick: () => void }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    new: { label: "Neu", color: "bg-purple-500/10 text-purple-400" },
    contacted: { label: "Kontaktiert", color: "bg-blue-500/10 text-blue-400" },
    qualified: { label: "Qualifiziert", color: "bg-green-500/10 text-green-400" },
    proposal: { label: "Angebot", color: "bg-orange-500/10 text-orange-400" },
  };

  const status = statusConfig[lead.status || "new"] || statusConfig.new;
  const createdAt = new Date(lead.created_at!);
  const isNew = (Date.now() - createdAt.getTime()) < 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-xl hover:bg-[#121212] transition-all text-left"
    >
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400 font-medium text-sm">
        {lead.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white truncate">{lead.name}</span>
          {isNew && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
        </div>
        {lead.company && (
          <div className="text-xs text-neutral-500 truncate">{lead.company}</div>
        )}
      </div>
      <span className={`text-[10px] px-2 py-1 rounded ${status.color}`}>
        {status.label}
      </span>
    </button>
  );
}

// Quote Card
function QuoteCard({ quote, onClick }: { quote: QuoteItem; onClick: () => void }) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    draft: { label: "Entwurf", color: "bg-neutral-500/10 text-neutral-400" },
    sent_to_lexware: { label: "An Lexware", color: "bg-blue-500/10 text-blue-400" },
    sent: { label: "Versendet", color: "bg-cyan-500/10 text-cyan-400" },
    open: { label: "Offen", color: "bg-yellow-500/10 text-yellow-400" },
  };

  const status = statusConfig[quote.status] || statusConfig.draft;
  const customerName = quote.customer 
    ? (quote.customer.company_name || `${quote.customer.first_name || ""} ${quote.customer.last_name || ""}`.trim())
    : null;
  const amount = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount || 0);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-xl hover:bg-[#121212] transition-all text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-white truncate">{quote.title || "Angebot"}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded ${status.color}`}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
          <span className="font-mono">{quote.quote_number || `#${quote.id.slice(0, 6)}`}</span>
          {customerName && (
            <>
              <span>·</span>
              <span className="truncate">{customerName}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-sm text-white">{amount}</div>
        <div className="text-[10px] text-neutral-500">
          {new Date(quote.quote_date).toLocaleDateString("de-DE")}
        </div>
      </div>
    </button>
  );
}

// Empty State
function EmptyState({ message, small }: { message: string; small?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-neutral-600 ${small ? "py-6" : "py-10"}`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
