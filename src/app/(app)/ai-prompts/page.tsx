"use client";

import { useState, useEffect } from "react";
import {
  loadAllPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "@/app/actions/ai-content-prompts";
import type { AIContentPrompt } from "@/types/ai-content";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type PromptFormData = Omit<AIContentPrompt, "id" | "created_at" | "updated_at">;

export default function AIPromptsPage() {
  const [prompts, setPrompts] = useState<AIContentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AIContentPrompt | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<PromptFormData>({
    domain: "",
    name: "",
    description: null,
    system_prompt: "",
    user_prompt_template: "",
    placeholder_fields: [],
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    loadPromptsData();
  }, []);

  const loadPromptsData = async () => {
    setLoading(true);
    const result = await loadAllPrompts();

    if (result.success && result.prompts) {
      setPrompts(result.prompts);
    } else {
      toast.error(result.error || "Fehler beim Laden");
    }

    setLoading(false);
  };

  const handleCreate = () => {
    setFormData({
      domain: "",
      name: "",
      description: null,
      system_prompt: "",
      user_prompt_template: "",
      placeholder_fields: [],
      is_active: true,
      sort_order: 0,
    });
    setCreating(true);
  };

  const handleEdit = (prompt: AIContentPrompt) => {
    setFormData({
      domain: prompt.domain,
      name: prompt.name,
      description: prompt.description,
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template,
      placeholder_fields: prompt.placeholder_fields,
      is_active: prompt.is_active,
      sort_order: prompt.sort_order,
    });
    setEditing(prompt);
  };

  const handleCancel = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.domain) {
      toast.error("Name und Domain sind Pflichtfelder");
      return;
    }

    if (creating) {
      const result = await createPrompt(formData);
      if (result.success) {
        toast.success("Prompt erstellt");
        await loadPromptsData();
        setCreating(false);
      } else {
        toast.error(result.error || "Fehler beim Erstellen");
      }
    } else if (editing) {
      const result = await updatePrompt(editing.id, formData);
      if (result.success) {
        toast.success("Prompt aktualisiert");
        await loadPromptsData();
        setEditing(null);
      } else {
        toast.error(result.error || "Fehler beim Aktualisieren");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Prompt wirklich löschen?")) return;

    const result = await deletePrompt(id);
    if (result.success) {
      toast.success("Prompt gelöscht");
      await loadPromptsData();
    } else {
      toast.error(result.error || "Fehler beim Löschen");
    }
  };

  const handlePlaceholderFieldsChange = (value: string) => {
    // Split by comma, trim, filter empty
    const fields = value
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f);
    setFormData({ ...formData, placeholder_fields: fields });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            KI-Content-Prompts
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Vorlagen für AI-generierte Inhalte verwalten
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neuer Prompt
        </button>
      </div>

      {/* Form (Create/Edit) */}
      {(creating || editing) && (
        <div className="mb-6 p-6 bg-neutral-900 border border-neutral-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-white">
              {creating ? "Neuer Prompt" : "Prompt bearbeiten"}
            </h2>
            <button
              onClick={handleCancel}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Domain *
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) =>
                  setFormData({ ...formData, domain: e.target.value })
                }
                placeholder="z.B. product_description"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="z.B. Marketing-Beschreibung"
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Beschreibung
            </label>
            <input
              type="text"
              value={formData.description || ""}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Kurze Erklärung..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              System Prompt *
            </label>
            <textarea
              value={formData.system_prompt}
              onChange={(e) =>
                setFormData({ ...formData, system_prompt: e.target.value })
              }
              rows={4}
              placeholder="Systemanweisung für den KI-Agenten..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              User Prompt Template *
            </label>
            <textarea
              value={formData.user_prompt_template}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  user_prompt_template: e.target.value,
                })
              }
              rows={6}
              placeholder="Benutzer-Prompt mit Mustache-Variablen: {{variable}}"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Verwenden Sie: {"{{variable}}"} für einfache Variablen,{" "}
              {"{{#condition}}"}...{"{{/condition}}"} für Bedingungen
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Platzhalter-Felder (kommagetrennt)
            </label>
            <input
              type="text"
              value={formData.placeholder_fields.join(", ")}
              onChange={(e) => handlePlaceholderFieldsChange(e.target.value)}
              placeholder="z.B. product_name, features, current_value"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Sortierung
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sort_order: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-neutral-300">Aktiv</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Hinweise zum Template-System:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-400">
            <li>
              <code className="text-xs bg-blue-950/50 px-1 py-0.5 rounded">
                {"{{variable}}"}
              </code>{" "}
              - Einfache Variable
            </li>
            <li>
              <code className="text-xs bg-blue-950/50 px-1 py-0.5 rounded">
                {"{{#condition}}...{{/condition}}"}
              </code>{" "}
              - Bedingter Block (nur wenn Variable gefüllt)
            </li>
            <li>
              <code className="text-xs bg-blue-950/50 px-1 py-0.5 rounded">
                current_value
              </code>{" "}
              - Spezielles Feld für aktuellen Feldwert (read-only im Modal)
            </li>
          </ul>
        </div>
      </div>

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.length === 0 ? (
          <div className="text-center py-12 bg-neutral-900 border border-neutral-800 rounded-xl">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
            <p className="text-neutral-400">Noch keine Prompts vorhanden.</p>
          </div>
        ) : (
          prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-medium text-white">
                      {prompt.name}
                    </h3>
                    <span className="px-2 py-0.5 text-xs bg-purple-900/30 text-purple-300 rounded-full">
                      {prompt.domain}
                    </span>
                    {!prompt.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-red-900/30 text-red-300 rounded-full">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  {prompt.description && (
                    <p className="text-sm text-neutral-400 mb-2">
                      {prompt.description}
                    </p>
                  )}
                  <div className="text-xs text-neutral-500 space-y-1">
                    <p>
                      <span className="font-medium">Felder:</span>{" "}
                      {prompt.placeholder_fields.length > 0
                        ? prompt.placeholder_fields.join(", ")
                        : "keine"}
                    </p>
                    <p>
                      <span className="font-medium">Sortierung:</span>{" "}
                      {prompt.sort_order}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(prompt)}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
