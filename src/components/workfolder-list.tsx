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
  FileText,
  Search,
  ListTodo,
  CheckCircle,
  Circle,
} from "lucide-react";
import type { Project, Customer, Task, WorkfolderStatusDef } from "@/types/database";

// Partial customer type for dropdown selections
type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;

// Icons für die Marken
const brandIcons: Record<string, string> = {
  "sofort-solar": "☀️",
  "nord-watt": "⚡",
  "gutachter-freese": "🔍",
  "media-bytes": "💻",
};

// Farben für Status-Badges
const statusColors: Record<string, string> = {
  gray: "bg-neutral-600 text-neutral-200",
  blue: "bg-blue-600 text-blue-100",
  cyan: "bg-cyan-600 text-cyan-100",
  yellow: "bg-yellow-600 text-yellow-100",
  orange: "bg-orange-600 text-orange-100",
  purple: "bg-purple-600 text-purple-100",
  green: "bg-green-600 text-green-100",
  neutral: "bg-neutral-700 text-neutral-300",
  red: "bg-red-600 text-red-100",
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

  // Status-Definitionen aus der Marke
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

    // Load workfolders
    const { data: wf } = await supabase
      .from("projects")
      .select("*, customer:customers(*)")
      .eq("parent_id", brand.id)
      .order("created_at", { ascending: false });
    setWorkfolders(wf || []);

    // Load customers
    const { data: custs } = await supabase
      .from("customers")
      .select("id, company_name, first_name, last_name")
      .eq("status", "active")
      .order("company_name");
    setCustomers(custs || []);

    // Load legacy tasks
    const { data: legacyTasks } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", brand.id)
      .order("created_at", { ascending: false });
    setTasks(legacyTasks || []);

    setLoading(false);
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
    if (!customer) return "Kein Kunde";
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unbenannt";
  }

  const filtered = workfolders.filter((wf) => {
    const matchesSearch = !search ||
      wf.name.toLowerCase().includes(search.toLowerCase()) ||
      getCustomerName(wf.customer).toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || wf.workfolder_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.push("/")} className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5 text-neutral-400" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1 truncate">{brand.name}</h1>
        <button onClick={() => setShowNewWorkfolder(true)} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Status Pills - Horizontal Scroll */}
      {statuses.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap ${
              !statusFilter ? "bg-orange-500 text-white" : "bg-neutral-800 text-neutral-400"
            }`}
          >
            Alle
          </button>
          {statuses.sort((a, b) => a.sort - b.sort).map((status) => (
            <button
              key={status.key}
              onClick={() => setStatusFilter(statusFilter === status.key ? null : status.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap ${
                statusFilter === status.key
                  ? statusColors[status.color] || "bg-neutral-600 text-white"
                  : "bg-neutral-800 text-neutral-400"
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {workfolders.length > 5 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-2">
          <p className="text-sm text-neutral-500 mb-4">
            Diese Tasks stammen aus der alten Struktur. Du kannst sie hier abhaken oder löschen.
          </p>
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`card p-3 flex items-center gap-3 ${
                task.status === "done" ? "opacity-60" : ""
              }`}
            >
              <button
                onClick={() => toggleTaskStatus(task)}
                className={`flex-shrink-0 ${
                  task.status === "done" ? "text-green-500" : "text-neutral-500"
                }`}
              >
                {task.status === "done" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${task.status === "done" ? "line-through text-neutral-500" : "text-white"}`}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-neutral-500 truncate">{task.description}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                task.status === "done" ? "bg-green-500/20 text-green-400" :
                task.status === "in_progress" ? "bg-blue-500/20 text-blue-400" :
                "bg-neutral-700 text-neutral-400"
              }`}>
                {task.status === "done" ? "Erledigt" : 
                 task.status === "in_progress" ? "In Arbeit" : "Offen"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Workfolders Grid (nur bei Projekten-Tab) */}
      {activeTab === "projects" && (
        filtered.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          {workfolders.length === 0 ? (
            <>
              <p>Noch keine Projekte in {brand.name}</p>
              <button
                onClick={() => setShowNewWorkfolder(true)}
                className="btn btn-primary btn-sm mt-4"
              >
                <Plus className="w-4 h-4" />
                Erstes Projekt anlegen
              </button>
            </>
          ) : (
            <p>Keine Projekte gefunden für "{search}"</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((wf) => {
            const statusDef = getStatusDef(wf.workfolder_status);
            return (
              <div
                key={wf.id}
                onClick={() => router.push(`/projects/${wf.slug}`)}
                className="card p-3 flex items-center gap-3 cursor-pointer active:bg-neutral-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{wf.name}</span>
                    {statusDef && (
                      <span className={`px-2 py-0.5 text-[10px] rounded-full shrink-0 ${statusColors[statusDef.color] || "bg-neutral-700 text-neutral-300"}`}>
                        {statusDef.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 truncate">
                    {getCustomerName(wf.customer)}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0" />
              </div>
            );
          })}
        </div>
      ))}

      {/* Modal: Neues Projekt */}
      <Modal
        open={showNewWorkfolder}
        onClose={() => setShowNewWorkfolder(false)}
        title={`Neues Projekt in ${brand.name}`}
      >
        <form onSubmit={createWorkfolder} className="space-y-4">
          <div>
            <label className="label">Projektname *</label>
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

          <div>
            <label className="label">Kunde</label>
            <select
              className="input"
              value={form.customer_id}
              onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            >
              <option value="">-- Kunde auswählen --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {getCustomerName(c)}
                </option>
              ))}
            </select>
          </div>

          {statuses.length > 0 && (
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {statuses.sort((a, b) => a.sort - b.sort).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Kurze Projektbeschreibung..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewWorkfolder(false)}
              className="btn btn-ghost"
            >
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner /> : "Projekt anlegen"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
