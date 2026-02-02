"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { ListTodo, Clock, CheckCircle, Users, Plus, Pencil, Upload, Briefcase, ChevronRight } from "lucide-react";
import type { Project, ProjectStats } from "@/types/database";

export function Dashboard() {
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({ open: 0, inProgress: 0, done: 0, leads: 0 });
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [uploading, setUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "#f97316",
    sort_order: 0,
    logo_url: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load only parent projects (Marken) - where parent_id is null
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .is("parent_id", null)
        .order("sort_order");

      const projectsWithStats: ProjectStats[] = [];

      for (const project of projectsData || []) {
        // Count child projects (Arbeitsmappen) instead of tasks
        const { count: totalChildren } = await supabase
          .from("projects")
          .select("*", { count: "exact", head: true })
          .eq("parent_id", project.id);

        projectsWithStats.push({
          ...project,
          total_tasks: totalChildren || 0,
          open_tasks: 0,
          in_progress_tasks: 0,
          done_tasks: 0,
        });
      }

      // Load active leads count
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .not("status", "in", '("won","lost")');

      setProjects(projectsWithStats);
      setTotalStats({
        open: projectsWithStats.reduce((sum, p) => sum + p.open_tasks, 0),
        inProgress: projectsWithStats.reduce((sum, p) => sum + p.in_progress_tasks, 0),
        done: projectsWithStats.reduce((sum, p) => sum + p.done_tasks, 0),
        leads: leadsCount || 0,
      });
    } catch (e) {
      console.error("Failed to load data:", e);
    }
    setLoading(false);
  }

  function openNew() {
    setEditingProject(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      icon: "",
      color: "#f97316",
      sort_order: projects.length,
      logo_url: "",
    });
    setShowModal(true);
  }

  function openEdit(e: React.MouseEvent, project: Project) {
    e.stopPropagation();
    setEditingProject(project);
    setForm({
      name: project.name,
      slug: project.slug,
      description: project.description || "",
      icon: project.icon || "",
      color: project.color || "#f97316",
      sort_order: project.sort_order ?? 0,
      logo_url: (project as any).logo_url || "",
    });
    setShowModal(true);
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    const fileName = `logos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { contentType: file.type });
    
    if (uploadError) {
      alert("Upload-Fehler: " + uploadError.message);
      setUploading(false);
      return;
    }
    
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);
    
    setForm({ ...form, logo_url: urlData.publicUrl });
    setUploading(false);
  }

  async function saveProject(e: React.FormEvent) {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const payload = { ...form, slug };

    if (editingProject) {
      await supabase.from("projects").update(payload).eq("id", editingProject.id);
    } else {
      await supabase.from("projects").insert(payload);
    }
    setShowModal(false);
    await loadData();
  }

  async function deleteProject() {
    if (!editingProject) return;
    if (!confirm("Projekt wirklich löschen? Alle Tasks bleiben erhalten, verlieren aber die Zuordnung.")) return;
    await supabase.from("projects").delete().eq("id", editingProject.id);
    setShowModal(false);
    await loadData();
  }

  function getProgressWidth(project: ProjectStats) {
    if (project.total_tasks === 0) return 0;
    return Math.round((project.done_tasks / project.total_tasks) * 100);
  }

  return (
    <div className="space-y-4">
      {/* Stats - Compact on Mobile */}
      <div className="grid grid-cols-4 gap-2">
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-orange-400">{totalStats.open}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Offen</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-blue-400">{totalStats.inProgress}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">In Arbeit</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-green-400">{totalStats.done}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Erledigt</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-xl font-bold text-purple-400">{totalStats.leads}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5">Leads</div>
        </div>
      </div>

      {/* Marken */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-white">Marken</h2>
          <button onClick={openNew} className="btn btn-primary btn-sm">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8"><Spinner /></div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">Keine Marken</div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/projects/${project.slug}`)}
                className="card p-3 flex items-center gap-3 cursor-pointer active:bg-neutral-800/50"
              >
                {(project as any).logo_url ? (
                  <img 
                    src={(project as any).logo_url} 
                    alt=""
                    className="w-10 h-10 rounded-lg object-contain bg-white/10 shrink-0"
                  />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shrink-0"
                    style={{ backgroundColor: project.color || "#f97316" }}
                  >
                    {project.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{project.name}</div>
                  <div className="text-xs text-neutral-500">{project.total_tasks} Projekte</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(e, project); }}
                  className="p-2 text-neutral-600 shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingProject ? "Marke bearbeiten" : "Neue Marke"}>
        <form onSubmit={saveProject} className="space-y-4">
          {/* Logo Upload */}
          <div className="form-group">
            <label className="form-label">Logo</label>
            <div className="flex items-center gap-4">
              {form.logo_url ? (
                <img 
                  src={form.logo_url} 
                  alt="Logo" 
                  className="w-16 h-16 rounded-lg object-contain bg-white/10"
                />
              ) : (
                <div 
                  className="w-16 h-16 rounded-lg flex items-center justify-center font-bold text-xl text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name ? form.name.charAt(0).toUpperCase() : "?"}
                </div>
              )}
              <div className="flex-1">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading}
                  className="btn btn-ghost btn-sm"
                >
                  {uploading ? <Spinner className="!w-4 !h-4" /> : <Upload className="w-4 h-4" />}
                  Logo hochladen
                </button>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                    className="btn btn-ghost btn-sm text-red-400 ml-2"
                  >
                    Entfernen
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="input"
              placeholder="z.B. Sofort.Solar"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Kurze Beschreibung"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Farbe (für Fallback ohne Logo)</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="input flex-1"
                placeholder="#f97316"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              Speichern
            </button>
            {editingProject && (
              <button type="button" onClick={deleteProject} className="btn btn-ghost text-red-400">
                Löschen
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
