"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { Plus, ChevronRight, Trash2 } from "lucide-react";
import type { Skill } from "@/types/database";

const triggerOptions = ["manual", "new_lead", "heartbeat", "daily", "on_demand"];

const triggerLabels: Record<string, string> = {
  manual: "🖱️ Manuell",
  new_lead: "👤 Neuer Lead",
  heartbeat: "💓 Heartbeat",
  daily: "📅 Täglich",
  on_demand: "⚡ On Demand",
};

export function SkillsTable() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    trigger: "manual",
    steps: "",
    active: true,
  });

  const supabase = createClient();

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    setLoading(true);
    try {
      const { data } = await supabase.from("skills").select("*").order("name");
      setSkills(data || []);
    } catch (err) {
      console.error("Skills load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingSkill(null);
    setForm({ name: "", description: "", trigger: "manual", steps: "", active: true });
    setShowForm(true);
  }

  function openEdit(skill: Skill) {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      description: skill.description || "",
      trigger: skill.trigger || "",
      steps: skill.steps || "",
      active: skill.active ?? true,
    });
    setShowForm(true);
  }

  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...form, updated_at: new Date().toISOString() };

    if (editingSkill) {
      await supabase.from("skills").update(payload).eq("id", editingSkill.id);
    } else {
      await supabase.from("skills").insert(payload);
    }
    setShowForm(false);
    await loadSkills();
  }

  async function toggleActive(skill: Skill, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase
      .from("skills")
      .update({ active: !skill.active, updated_at: new Date().toISOString() })
      .eq("id", skill.id);
    await loadSkills();
  }

  async function deleteSkill(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Skill wirklich löschen?")) return;
    await supabase.from("skills").delete().eq("id", id);
    await loadSkills();
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1f1f]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">🧠 Skills & Abläufe</h2>
            <p className="text-sm text-neutral-500">Workflows die Bro ausführen kann</p>
          </div>
          <button onClick={openNew} className="btn btn-primary">
            <Plus className="w-5 h-5" />
            Neuer Skill
          </button>
        </div>
      </div>

      {/* Skills List */}
      {loading ? (
        <div className="p-8 text-center">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Skills...</p>
        </div>
      ) : skills.length === 0 ? (
        <div className="p-12 text-center text-neutral-500">
          <span className="text-4xl mb-4 block">🧠</span>
          Keine Skills vorhanden
        </div>
      ) : (
        <div className="divide-y divide-[#1f1f1f]">
          {skills.map((skill) => (
            <div
              key={skill.id}
              onClick={() => openEdit(skill)}
              className="list-item w-full text-left group cursor-pointer"
            >
              {/* Status Indicator */}
              <div className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${skill.active ? "bg-green-500" : "bg-neutral-600"}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{skill.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`badge ${skill.active ? "badge-success" : "badge-gray"}`}>
                        {skill.active ? "Aktiv" : "Inaktiv"}
                      </span>
                      <span className="badge badge-info">{triggerLabels[skill.trigger || "manual"]}</span>
                      <span className="text-xs text-neutral-600">
                        Aktualisiert: {skill.updated_at ? new Date(skill.updated_at).toLocaleDateString("de-DE") : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => toggleActive(skill, e)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0"
                  title={skill.active ? "Deaktivieren" : "Aktivieren"}
                >
                  {skill.active ? "⏸️" : "▶️"}
                </button>
                <button
                  onClick={(e) => deleteSkill(skill.id, e)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 hover:!text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Arrow */}
              <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0 sm:hidden" />
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingSkill ? "Skill bearbeiten" : "Neuer Skill"}
        className="md:max-w-3xl"
      >
        <form onSubmit={saveSkill} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="input"
                placeholder="z.B. Lead E-Mail generieren"
              />
            </div>
            <div>
              <label className="form-label">Trigger</label>
              <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="input">
                {triggerOptions.map((t) => (
                  <option key={t} value={t}>
                    {triggerLabels[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Beschreibung</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Kurze Beschreibung des Skills"
            />
          </div>

          <div>
            <label className="form-label">Schritte / Ablauf (Markdown)</label>
            <textarea
              value={form.steps}
              onChange={(e) => setForm({ ...form, steps: e.target.value })}
              rows={12}
              className="input font-mono text-sm"
              placeholder="## Ablauf&#10;&#10;1. Erster Schritt&#10;2. Zweiter Schritt&#10;..."
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              id="active"
              className="w-5 h-5"
            />
            <label htmlFor="active" className="text-sm text-neutral-400">
              Skill aktiv
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" className="btn btn-primary flex-1">
              Speichern
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
