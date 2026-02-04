"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  ListTodo,
  CheckCircle2,
  Circle,
  Calendar,
  Building2,
  AlertTriangle,
  Clock,
  ChevronDown,
} from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  project: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function PartnerAufgabenPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [updating, setUpdating] = useState<string | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    loadPartnerAndTasks();
  }, []);

  async function loadPartnerAndTasks() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: partnerUser } = await supabase
        .from("partner_users")
        .select("partner_id")
        .eq("auth_user_id", user.id)
        .single();

      if (!partnerUser) {
        setLoading(false);
        return;
      }

      setPartnerId(partnerUser.partner_id);

      const { data: tasksData } = await supabase
        .from("project_tasks")
        .select(`
          id, title, description, status, priority, due_date, created_at,
          project:projects!project_id (id, name, slug)
        `)
        .eq("assigned_partner_id", partnerUser.partner_id)
        .order("priority", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      setTasks((tasksData as any) || []);
    } catch (err) {
      console.error("Error loading tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: string) {
    setUpdating(taskId);
    
    const { error } = await supabase
      .from("project_tasks")
      .update({ 
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", taskId);

    if (!error) {
      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));
    }
    
    setUpdating(null);
  }

  const priorityConfig: Record<string, { label: string; color: string; sort: number }> = {
    urgent: { label: "Dringend", color: "text-red-400 bg-red-500/10", sort: 0 },
    high: { label: "Hoch", color: "text-orange-400 bg-orange-500/10", sort: 1 },
    normal: { label: "Normal", color: "text-neutral-400 bg-neutral-500/10", sort: 2 },
    low: { label: "Niedrig", color: "text-neutral-500 bg-neutral-500/10", sort: 3 },
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === "open") return t.status !== "done" && t.status !== "cancelled";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const openCount = tasks.filter(t => t.status !== "done" && t.status !== "cancelled").length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const overdueCount = tasks.filter(t => 
    t.due_date && 
    new Date(t.due_date) < new Date() && 
    t.status !== "done"
  ).length;

  // Gruppiere nach Projekt
  const groupedByProject = filteredTasks.reduce((acc, task) => {
    const projectName = task.project?.name || "Ohne Projekt";
    if (!acc[projectName]) acc[projectName] = [];
    acc[projectName].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ListTodo className="w-7 h-7 text-[#fa432a]" />
          Meine Aufgaben
        </h1>
        <p className="text-neutral-400 mt-1">
          Übersicht aller Ihnen zugewiesenen Aufgaben
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setFilter("open")}
          className={`card p-4 text-left transition-all ${
            filter === "open" ? "ring-2 ring-[#fa432a]" : "hover:bg-neutral-800/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{openCount}</p>
              <p className="text-sm text-neutral-400">Offen</p>
            </div>
            <Circle className="w-8 h-8 text-yellow-400 opacity-50" />
          </div>
          {overdueCount > 0 && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} überfällig
            </p>
          )}
        </button>

        <button
          onClick={() => setFilter("done")}
          className={`card p-4 text-left transition-all ${
            filter === "done" ? "ring-2 ring-[#fa432a]" : "hover:bg-neutral-800/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{doneCount}</p>
              <p className="text-sm text-neutral-400">Erledigt</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-400 opacity-50" />
          </div>
        </button>

        <button
          onClick={() => setFilter("all")}
          className={`card p-4 text-left transition-all ${
            filter === "all" ? "ring-2 ring-[#fa432a]" : "hover:bg-neutral-800/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">{tasks.length}</p>
              <p className="text-sm text-neutral-400">Gesamt</p>
            </div>
            <ListTodo className="w-8 h-8 text-neutral-400 opacity-50" />
          </div>
        </button>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className="card p-12 text-center">
          <ListTodo className="w-12 h-12 mx-auto mb-4 text-neutral-600" />
          <p className="text-neutral-400">
            {filter === "open" ? "Keine offenen Aufgaben" : 
             filter === "done" ? "Noch keine erledigten Aufgaben" : 
             "Keine Aufgaben vorhanden"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByProject).map(([projectName, projectTasks]) => (
            <div key={projectName} className="card overflow-hidden">
              {/* Project Header */}
              <div className="px-4 py-3 bg-neutral-900/50 border-b border-neutral-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#fa432a]" />
                <span className="font-medium text-white">{projectName}</span>
                <span className="text-xs text-neutral-500">({projectTasks.length})</span>
              </div>

              {/* Tasks Table */}
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800">
                    <th className="text-left py-2 px-4 w-10"></th>
                    <th className="text-left py-2 px-4">Aufgabe</th>
                    <th className="text-left py-2 px-4 w-24">Priorität</th>
                    <th className="text-left py-2 px-4 w-32">Fällig</th>
                    <th className="text-left py-2 px-4 w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectTasks.map((task) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                    const isDone = task.status === "done";
                    const priority = priorityConfig[task.priority] || priorityConfig.normal;
                    
                    return (
                      <tr 
                        key={task.id} 
                        className={`border-b border-neutral-800/50 last:border-0 transition-colors ${
                          isDone ? "opacity-50" : "hover:bg-neutral-800/30"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4">
                          <button
                            onClick={() => updateTaskStatus(task.id, isDone ? "open" : "done")}
                            disabled={updating === task.id}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isDone 
                                ? "border-green-500 bg-green-500/20 text-green-400" 
                                : "border-neutral-600 hover:border-[#fa432a]"
                            } ${updating === task.id ? "opacity-50" : ""}`}
                          >
                            {isDone && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                        </td>

                        {/* Task Info */}
                        <td className="py-3 px-4">
                          <p className={`font-medium ${isDone ? "line-through text-neutral-500" : "text-white"}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                        </td>

                        {/* Priority */}
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded ${priority.color}`}>
                            {priority.label}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-3 px-4">
                          {task.due_date ? (
                            <span className={`text-sm flex items-center gap-1 ${
                              isOverdue ? "text-red-400" : "text-neutral-400"
                            }`}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              <Calendar className="w-3 h-3" />
                              {new Date(task.due_date).toLocaleDateString("de-DE")}
                            </span>
                          ) : (
                            <span className="text-neutral-600 text-sm">–</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <select
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                            disabled={updating === task.id}
                            className="bg-neutral-800 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs w-full"
                          >
                            <option value="open">Offen</option>
                            <option value="in_progress">In Arbeit</option>
                            <option value="done">Erledigt</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
