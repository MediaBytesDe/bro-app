"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { ChevronLeft, Plus, Settings, Play, Trash2, Check } from "lucide-react";
import type { Project, Task, Category, Skill } from "@/types/database";

const statusOptions = ["open", "in_progress", "blocked", "done"] as const;
const priorityOptions = ["1", "2", "3", "normal", "low"];
const statusLabels: Record<string, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  blocked: "Blockiert",
  done: "Erledigt",
};
const priorityIcons: Record<string, string> = {
  "1": "🔥",
  "2": "⚡",
  "3": "📌",
  normal: "",
  low: "💤",
};

interface Props {
  project: Project;
}

export function ProjectDetail({ project }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", sort_order: 0 });
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "open" as Task["status"],
    priority: "normal",
    category_id: null as string | null,
    skill: null as string | null,
    due_date: "",
    type: "manual",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [project.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [catRes, taskRes, skillsRes] = await Promise.all([
        supabase.from("categories").select("*").eq("project_id", project.id).order("sort_order"),
        supabase
          .from("tasks")
          .select("*, category:categories(name)")
          .eq("project_id", project.id)
          .order("run_requested_at", { ascending: false, nullsFirst: false })
          .order("priority", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase.from("skills").select("*").eq("active", true).order("name"),
      ]);
      setCategories(catRes.data || []);
      setTasks(taskRes.data || []);
      setSkills(skillsRes.data || []);
    } catch (e) {
      console.error("Failed to load:", e);
    }
    setLoading(false);
  }

  const filteredTasks = tasks.filter((t) => {
    const matchesText = !filter || t.title?.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = !selectedCategory || t.category_id === selectedCategory;
    return matchesText && matchesCategory;
  });

  const tasksByStatus = {
    open: filteredTasks.filter((t) => t.status === "open"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    done: filteredTasks.filter((t) => t.status === "done").slice(0, 10),
  };

  function openNew(categoryId: string | null = null) {
    setEditingTask(null);
    setForm({
      title: "",
      description: "",
      status: "open",
      priority: "normal",
      category_id: categoryId,
      skill: null,
      due_date: "",
      type: "manual",
    });
    setShowForm(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      status: task.status || "open",
      priority: task.priority || "medium",
      category_id: task.category_id || "",
      skill: task.skill || "",
      due_date: task.due_date ? task.due_date.slice(0, 16) : "",
      type: task.type || "task",
    });
    setShowForm(true);
  }

  async function saveTask(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      project_id: project.id,
      updated_at: new Date().toISOString(),
      due_date: form.due_date || null,
      category_id: form.category_id || null,
    };

    if (editingTask) {
      await supabase.from("tasks").update(payload).eq("id", editingTask.id);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    setShowForm(false);
    await loadData();
  }

  async function toggleStatus(task: Task) {
    const newStatus = task.status === "done" ? "open" : "done";
    const payload: Partial<Task> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === "done") payload.completed_at = new Date().toISOString();
    await supabase.from("tasks").update(payload).eq("id", task.id);
    await loadData();
  }

  async function deleteTask(id: string) {
    if (!confirm("Task löschen?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    await loadData();
  }

  async function requestRun(task: Task) {
    await supabase.from("tasks").update({ run_requested_at: new Date().toISOString() }).eq("id", task.id);
    alert(`▶️ Task "${task.title}" wurde in die Queue gestellt. Bro wird ihn in Kürze bearbeiten.`);
    await loadData();
  }

  function getCategoryStats(catId: string) {
    const catTasks = tasks.filter((t) => t.category_id === catId);
    return {
      total: catTasks.length,
      open: catTasks.filter((t) => t.status === "open").length,
      done: catTasks.filter((t) => t.status === "done").length,
    };
  }

  // Category Management
  function openCategoryModal() {
    setEditingCategory(null);
    setCategoryForm({ name: "", slug: "", sort_order: categories.length });
    setShowCategoryModal(true);
  }

  function editCategory(cat: Category) {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, slug: cat.slug, sort_order: cat.sort_order || 0 });
    setShowCategoryModal(true);
  }

  async function saveCategory(e: React.FormEvent) {
    e.preventDefault();
    const slug =
      categoryForm.slug ||
      categoryForm.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
    const payload = {
      name: categoryForm.name,
      slug,
      sort_order: categoryForm.sort_order,
      project_id: project.id,
    };

    if (editingCategory) {
      await supabase.from("categories").update(payload).eq("id", editingCategory.id);
    } else {
      await supabase.from("categories").insert(payload);
    }
    setShowCategoryModal(false);
    await loadData();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Kategorie löschen? Tasks werden nicht gelöscht, nur die Zuordnung entfernt.")) return;
    await supabase.from("categories").delete().eq("id", id);
    await loadData();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#1a1a1a]">
        <button onClick={() => router.push("/")} className="btn btn-ghost btn-icon">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-2xl">{project.icon}</span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{project.name}</h1>
          <p className="text-sm text-neutral-500">
            {tasks.length} Tasks • {tasks.filter((t) => t.status === "open").length} offen
          </p>
        </div>
        <button onClick={openCategoryModal} className="btn btn-ghost btn-icon" title="Kategorien verwalten">
          <Settings className="w-5 h-5" />
        </button>
        <button onClick={() => openNew()} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Task</span>
        </button>
      </div>

      {/* Kategorien horizontal */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`category-chip ${!selectedCategory ? "active" : ""}`}
          >
            Alle ({tasks.length})
          </button>
          {categories.map((cat) => {
            const stats = getCategoryStats(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`category-chip ${selectedCategory === cat.id ? "active" : ""}`}
              >
                {cat.name} ({stats.open}/{stats.total})
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Tasks durchsuchen..."
        className="input w-full"
      />

      {loading ? (
        <div className="empty-state py-12">
          <Spinner />
        </div>
      ) : (
        /* Kanban-artige Darstellung */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Offen */}
          <div className="task-column">
            <div className="column-header">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              <span>Offen</span>
              <span className="text-neutral-500">({tasksByStatus.open.length})</span>
            </div>
            <div className="task-list">
              {tasksByStatus.open.map((task) => (
                <div key={task.id} className="task-card group" onClick={() => openEdit(task)}>
                  <div className="flex items-start gap-2">
                    <button onClick={(e) => { e.stopPropagation(); toggleStatus(task); }} className="checkbox" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {priorityIcons[task.priority || "medium"] && <span className="mr-1">{priorityIcons[task.priority || "medium"]}</span>}
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {task.category_id && <span className="text-[10px] text-neutral-500">{task.category_id}</span>}
                        {task.run_requested_at && <span className="text-[10px] text-orange-400">⏳ Queued</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); requestRun(task); }}
                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 active:scale-95 transition-all"
                        title="Jetzt ausführen"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
                        title="Löschen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {tasksByStatus.open.length === 0 && (
                <div className="text-center py-4 text-neutral-600 text-sm">Keine offenen Tasks</div>
              )}
            </div>
          </div>

          {/* In Arbeit */}
          <div className="task-column">
            <div className="column-header">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span>In Arbeit</span>
              <span className="text-neutral-500">({tasksByStatus.in_progress.length})</span>
            </div>
            <div className="task-list">
              {tasksByStatus.in_progress.map((task) => (
                <div key={task.id} className="task-card group" onClick={() => openEdit(task)}>
                  <div className="flex items-start gap-2">
                    <button onClick={(e) => { e.stopPropagation(); toggleStatus(task); }} className="checkbox border-blue-400" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{task.title}</h4>
                      {task.category_id && <span className="text-[10px] text-neutral-500">{task.category_id}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {tasksByStatus.in_progress.length === 0 && (
                <div className="text-center py-4 text-neutral-600 text-sm">Nichts in Arbeit</div>
              )}
            </div>
          </div>

          {/* Erledigt */}
          <div className="task-column">
            <div className="column-header">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span>Erledigt</span>
              <span className="text-neutral-500">({tasks.filter((t) => t.status === "done").length})</span>
            </div>
            <div className="task-list opacity-60">
              {tasksByStatus.done.map((task) => (
                <div key={task.id} className="task-card" onClick={() => openEdit(task)}>
                  <div className="flex items-start gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStatus(task); }}
                      className="checkbox bg-green-500 border-green-500"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <h4 className="text-sm text-neutral-400 line-through truncate">{task.title}</h4>
                  </div>
                </div>
              ))}
              {tasksByStatus.done.length === 0 && (
                <div className="text-center py-4 text-neutral-600 text-sm">Noch nichts erledigt</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editingTask ? "Task bearbeiten" : "Neuer Task"}>
        <form onSubmit={saveTask} className="space-y-3">
          <div className="form-group">
            <label className="form-label">Titel *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className="input"
              placeholder="Was muss erledigt werden?"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="input"
              placeholder="Details, Links, Notizen..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Kategorie</label>
              <select
                value={form.category_id || ""}
                onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
                className="input"
              >
                <option value="">Keine</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priorität</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
                <option value="1">🔥 Höchste</option>
                <option value="2">⚡ Hoch</option>
                <option value="3">📌 Mittel</option>
                <option value="normal">Normal</option>
                <option value="low">💤 Niedrig</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                value={form.status || "open"}
                onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                className="input"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {statusLabels[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Skill</label>
              <select
                value={form.skill || ""}
                onChange={(e) => setForm({ ...form, skill: e.target.value || null })}
                className="input"
              >
                <option value="">Keiner</option>
                {skills.map((skill) => (
                  <option key={skill.id} value={skill.name}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Fällig</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              Speichern
            </button>
            {editingTask && (
              <button type="button" onClick={() => deleteTask(editingTask.id)} className="btn btn-ghost text-red-400">
                Löschen
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Kategorien verwalten" className="max-w-lg">
        {/* Existing Categories */}
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2 p-2 bg-[#111] rounded-lg border border-[#1a1a1a]">
              <span className="flex-1 text-sm text-white">{cat.name}</span>
              <span className="text-xs text-neutral-500">{getCategoryStats(cat.id).total} Tasks</span>
              <button onClick={() => editCategory(cat)} className="p-1 text-neutral-500 hover:text-blue-400">
                ✏️
              </button>
              <button onClick={() => deleteCategory(cat.id)} className="p-1 text-neutral-500 hover:text-red-400">
                🗑️
              </button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">Keine Kategorien vorhanden</p>}
        </div>

        {/* Add/Edit Form */}
        <form onSubmit={saveCategory} className="space-y-3 pt-3 border-t border-[#1a1a1a]">
          <h3 className="text-sm font-medium text-neutral-400">
            {editingCategory ? "Kategorie bearbeiten" : "Neue Kategorie"}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
                className="input"
                placeholder="z.B. Lead-Generierung"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Reihenfolge</label>
              <input
                type="number"
                value={categoryForm.sort_order}
                onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 0 })}
                className="input"
                min={0}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary flex-1">
              {editingCategory ? "Speichern" : "Hinzufügen"}
            </button>
            {editingCategory && (
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: "", slug: "", sort_order: categories.length });
                }}
                className="btn btn-secondary"
              >
                Abbrechen
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
