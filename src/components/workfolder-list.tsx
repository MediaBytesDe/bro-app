"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  ChevronRight,
  Users,
  Calendar,
  Search,
  ListTodo,
  CheckCircle,
  Circle,
  X,
} from "lucide-react";
import type { Project, Customer, Task, WorkfolderStatusDef } from "@/types/database";

type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;

const brandIcons: Record<string, string> = {
  "sofort-solar": "☀️",
  "nord-watt": "⚡",
  "gutachter-freese": "🔍",
  "media-bytes": "💻",
};

const statusColors: Record<string, { bg: string; text: string }> = {
  gray: { bg: "bg-neutral-500/20", text: "text-neutral-400" },
  blue: { bg: "bg-blue-500/20", text: "text-[#fa432a]" },
  cyan: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  orange: { bg: "bg-orange-500/20", text: "text-[#fa432a]" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400" },
  green: { bg: "bg-green-500/20", text: "text-green-400" },
  red: { bg: "bg-red-500/20", text: "text-red-400" },
  neutral: { bg: "bg-neutral-500/20", text: "text-neutral-400" },
};

interface Props {
  brand: Project;
}

export function WorkfolderList({ brand }: Props) {
  const [workfolders, setWorkfolders] = useState<(Project & { customer?: Customer })[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewWorkfolder, setShowNewWorkfolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"projects" | "tasks">("projects");
  const [form, setForm] = useState({
    name: "",
    description: "",
    customer_id: "",
    status: "neu",
  });

  const statuses: WorkfolderStatusDef[] = (brand.workfolder_statuses as WorkfolderStatusDef[]) || [];
  
  function getStatusDef(key: string | null): WorkfolderStatusDef | undefined {
    return statuses.find(s => s.key === key);
  }

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [brand.id]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: wf } = await supabase
        .from("projects")
        .select("*, customer:customers(*)")
        .eq("parent_id", brand.id)
        .order("created_at", { ascending: false });
      setWorkfolders(wf || []);

      const { data: custs } = await supabase
        .from("customers")
        .select("id, company_name, first_name, last_name")
        .eq("status", "active")
        .order("company_name");
      setCustomers(custs || []);

      const { data: legacyTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", brand.id)
        .order("created_at", { ascending: false });
      setTasks(legacyTasks || []);
    } catch (err) {
      console.error("Workfolder list load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleTaskStatus(task: Task) {
    const newStatus = task.status === "done" ? "open" : "done";
    await supabase
      .from("tasks")
      .update({ 
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null
      })
      .eq("id", task.id);
    loadData();
  }

  async function createWorkfolder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSaving(true);

    const slug = form.name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: form.name,
        slug: `${brand.slug}-${slug}-${Date.now()}`,
        description: form.description || null,
        parent_id: brand.id,
        customer_id: form.customer_id || null,
        workfolder_status: form.status || "neu",
      })
      .select("slug")
      .single();

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowNewWorkfolder(false);
    setForm({ name: "", description: "", customer_id: "", status: "neu" });

    if (data) {
      router.push(`/projects/${data.slug}`);
    }
  }

  function getCustomerName(customer: Customer | null | undefined) {
    if (!customer) return null;
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || null;
  }

  const filtered = workfolders.filter((wf) => {
    const matchesSearch = !search ||
      wf.name.toLowerCase().includes(search.toLowerCase()) ||
      (getCustomerName(wf.customer) || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || wf.workfolder_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header - Compact auf Mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#111] border border-[#1a1a1a] text-neutral-400 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 truncate">
            <span className="text-2xl">{brandIcons[brand.slug] || "📁"}</span>
            {brand.name}
          </h1>
          <p className="text-sm text-neutral-500">
            {workfolders.length} Projekt{workfolders.length !== 1 ? "e" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowNewWorkfolder(true)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fa432a] to-[#ff6b4a] flex items-center justify-center text-white shadow-lg shadow-[#fa432a]/20 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs - Pill Style */}
      {tasks.length > 0 && (
        <div className="flex gap-2 p-1 bg-[#111] rounded-2xl">
          <button
            onClick={() => setActiveTab("projects")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === "projects"
                ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-[#fa432a]"
                : "text-neutral-400"
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Projekte
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
              activeTab === "tasks"
                ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-[#fa432a]"
                : "text-neutral-400"
            }`}
          >
            <ListTodo className="w-4 h-4" />
            Tasks
          </button>
        </div>
      )}

      {/* Status Filter - Horizontal Scroll */}
      {activeTab === "projects" && statuses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setStatusFilter(null)}
            className={`chip whitespace-nowrap ${!statusFilter ? "active" : ""}`}
          >
            Alle ({workfolders.length})
          </button>
          {statuses.sort((a, b) => a.sort - b.sort).map((status) => {
            const count = workfolders.filter(wf => wf.workfolder_status === status.key).length;
            const colors = statusColors[status.color] || statusColors.neutral;
            return (
              <button
                key={status.key}
                onClick={() => setStatusFilter(statusFilter === status.key ? null : status.key)}
                className={`chip whitespace-nowrap ${statusFilter === status.key ? colors.bg + " " + colors.text : ""}`}
              >
                {status.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      {activeTab === "projects" && workfolders.length > 5 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-neutral-400" />
            </button>
          )}
        </div>
      )}

      {/* Tasks Tab Content */}
      {activeTab === "tasks" && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Keine alten Tasks vorhanden</p>
            </div>
          ) : (
            tasks.map((task, i) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-4 bg-[#111] border border-[#1a1a1a] rounded-2xl active:scale-[0.98] transition-all ${
                  task.status === "done" ? "opacity-60" : ""
                }`}
                style={{ 
                  animationDelay: `${i * 30}ms`,
                  animation: "fadeSlideUp 0.3s ease forwards",
                  opacity: 0,
                }}
                onClick={() => toggleTaskStatus(task)}
              >
                <div className={`flex-shrink-0 ${task.status === "done" ? "text-green-500" : "text-neutral-600"}`}>
                  {task.status === "done" ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${task.status === "done" ? "line-through text-neutral-500" : "text-white"}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-sm text-neutral-500 truncate mt-0.5">{task.description}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Projects Grid */}
      {activeTab === "projects" && (
        filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center">
              <FolderOpen className="w-10 h-10 text-[#fa432a]/50" />
            </div>
            {workfolders.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Noch keine Projekte</h3>
                <p className="text-neutral-500 mb-6 max-w-xs mx-auto">
                  Erstelle dein erstes Projekt in {brand.name}
                </p>
                <button onClick={() => setShowNewWorkfolder(true)} className="btn btn-primary">
                  <Plus className="w-4 h-4" />
                  Projekt erstellen
                </button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-white mb-2">Keine Treffer</h3>
                <p className="text-neutral-500">Keine Projekte für "{search}" gefunden</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((wf, i) => {
              const statusDef = getStatusDef(wf.workfolder_status);
              const colors = statusDef ? (statusColors[statusDef.color] || statusColors.neutral) : null;
              
              return (
                <div
                  key={wf.id}
                  onClick={() => router.push(`/projects/${wf.slug}`)}
                  className="group p-4 bg-[#111] border border-[#1a1a1a] rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
                  style={{ 
                    animationDelay: `${i * 40}ms`,
                    animation: "fadeSlideUp 0.3s ease forwards",
                    opacity: 0,
                  }}
                >
                  {/* Top Row: Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-white group-active:text-[#fa432a] transition-colors flex-1 min-w-0 truncate">
                      {wf.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {statusDef && colors && (
                        <span className={`status-pill ${colors.bg} ${colors.text}`}>
                          {statusDef.label}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-neutral-600 group-active:text-[#fa432a]" />
                    </div>
                  </div>

                  {/* Description */}
                  {wf.description && (
                    <p className="text-sm text-neutral-400 line-clamp-2 mb-3">
                      {wf.description}
                    </p>
                  )}

                  {/* Meta Row */}
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    {getCustomerName(wf.customer) && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{getCustomerName(wf.customer)}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(wf.created_at || "").toLocaleDateString("de-DE", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* New Project Modal */}
      <Modal
        open={showNewWorkfolder}
        onClose={() => setShowNewWorkfolder(false)}
        title="Neues Projekt"
      >
        <form onSubmit={createWorkfolder} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Projektname</label>
            <input
              type="text"
              className="input"
              placeholder="z.B. PV-Anlage Müller"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Kunde</label>
            <select
              className="input"
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            >
              <option value="">Kein Kunde</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCustomerName(c) || "Unbenannt"}
                </option>
              ))}
            </select>
          </div>

          {statuses.length > 0 && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <div className="flex gap-2 flex-wrap">
                {statuses.sort((a, b) => a.sort - b.sort).map((s) => {
                  const colors = statusColors[s.color] || statusColors.neutral;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.key })}
                      className={`chip ${form.status === s.key ? colors.bg + " " + colors.text : ""}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Optional"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner /> : "Erstellen"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewWorkfolder(false)}
              className="btn btn-ghost"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
