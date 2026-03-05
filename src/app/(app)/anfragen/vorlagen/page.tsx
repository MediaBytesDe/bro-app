"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { useTrades } from "@/hooks/use-trades";
import type { InquiryTemplate, InquiryTemplateField } from "@/lib/inquiries/types";
import {
  ClipboardList,
  Plus,
  Search,
  Pencil,
  XCircle,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Trash2,
  RotateCcw,
  FileText,
  Hash,
  ListChecks,
  Camera,
  Type,
  ToggleLeft,
} from "lucide-react";

const FIELD_TYPE_LABELS: Record<string, { label: string; icon: typeof Type }> = {
  text: { label: "Text", icon: Type },
  number: { label: "Zahl", icon: Hash },
  select: { label: "Auswahl", icon: ListChecks },
  checkbox: { label: "Checkbox", icon: ToggleLeft },
  photo: { label: "Foto", icon: Camera },
};

const EMPTY_FIELD: InquiryTemplateField = {
  key: "",
  label: "",
  type: "text",
  options: [],
  required: false,
  group: "",
};

interface TemplateForm {
  id?: string;
  trade: string;
  name: string;
  description: string;
  fields: InquiryTemplateField[];
}

const EMPTY_FORM: TemplateForm = {
  trade: "",
  name: "",
  description: "",
  fields: [],
};

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export default function InquiryTemplatesPage() {
  const [templates, setTemplates] = useState<InquiryTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateForm>({ ...EMPTY_FORM });
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldDraft, setFieldDraft] = useState<InquiryTemplateField>({ ...EMPTY_FIELD });
  const [optionInput, setOptionInput] = useState("");

  const { trades, loading: tradesLoading } = useTrades();

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inquiries/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", include_inactive: true }),
      });
      const json = await res.json();
      if (json.data) {
        setTemplates(json.data);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Group templates by trade
  const getTradeLabel = (slug: string) => {
    const trade = trades.find((t) => t.slug === slug);
    return trade?.label || slug;
  };

  const filteredTemplates = templates.filter((t) => {
    if (!showInactive && !t.is_active) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(s) ||
      t.description?.toLowerCase().includes(s) ||
      getTradeLabel(t.trade).toLowerCase().includes(s)
    );
  });

  const grouped = filteredTemplates.reduce<Record<string, InquiryTemplate[]>>((acc, t) => {
    if (!acc[t.trade]) acc[t.trade] = [];
    acc[t.trade].push(t);
    return acc;
  }, {});

  const sortedTrades = Object.keys(grouped).sort((a, b) =>
    getTradeLabel(a).localeCompare(getTradeLabel(b))
  );

  // Form handlers
  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditingFieldIndex(null);
    setFieldDraft({ ...EMPTY_FIELD });
    setShowForm(true);
  }

  function openEdit(template: InquiryTemplate) {
    setForm({
      id: template.id,
      trade: template.trade,
      name: template.name,
      description: template.description || "",
      fields: [...template.fields],
    });
    setEditingFieldIndex(null);
    setFieldDraft({ ...EMPTY_FIELD });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm({ ...EMPTY_FORM });
    setEditingFieldIndex(null);
  }

  // Field management
  function startAddField() {
    setFieldDraft({ ...EMPTY_FIELD });
    setEditingFieldIndex(-1); // -1 = new field
    setOptionInput("");
  }

  function startEditField(index: number) {
    setFieldDraft({ ...form.fields[index] });
    setEditingFieldIndex(index);
    setOptionInput("");
  }

  function cancelFieldEdit() {
    setEditingFieldIndex(null);
    setFieldDraft({ ...EMPTY_FIELD });
    setOptionInput("");
  }

  function saveField() {
    const draft = { ...fieldDraft };
    if (!draft.label.trim()) return;
    if (!draft.key) {
      draft.key = toSnakeCase(draft.label);
    }
    if (draft.type !== "select") {
      draft.options = undefined;
    }
    if (!draft.group?.trim()) {
      draft.group = undefined;
    }

    const newFields = [...form.fields];
    if (editingFieldIndex === -1) {
      newFields.push(draft);
    } else if (editingFieldIndex !== null) {
      newFields[editingFieldIndex] = draft;
    }
    setForm({ ...form, fields: newFields });
    cancelFieldEdit();
  }

  function removeField(index: number) {
    const newFields = form.fields.filter((_, i) => i !== index);
    setForm({ ...form, fields: newFields });
    if (editingFieldIndex === index) cancelFieldEdit();
  }

  function moveField(index: number, direction: "up" | "down") {
    const newFields = [...form.fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setForm({ ...form, fields: newFields });
  }

  function addOption() {
    const val = optionInput.trim();
    if (!val) return;
    setFieldDraft({
      ...fieldDraft,
      options: [...(fieldDraft.options || []), val],
    });
    setOptionInput("");
  }

  function removeOption(index: number) {
    setFieldDraft({
      ...fieldDraft,
      options: (fieldDraft.options || []).filter((_, i) => i !== index),
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.trade) return;

    setSaving(true);
    try {
      const action = form.id ? "update" : "create";
      const payload: Record<string, unknown> = {
        action,
        trade: form.trade,
        name: form.name,
        description: form.description || null,
        fields: form.fields,
      };
      if (form.id) payload.id = form.id;

      const res = await fetch("/api/inquiries/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.error) {
        alert("Fehler: " + json.error);
      } else {
        closeForm();
        await loadTemplates();
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(template: InquiryTemplate) {
    try {
      const action = template.is_active ? "delete" : "update";
      const payload: Record<string, unknown> = {
        action,
        id: template.id,
      };
      if (!template.is_active) {
        payload.is_active = true;
      }

      const res = await fetch("/api/inquiries/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) {
        alert("Fehler: " + json.error);
      } else {
        await loadTemplates();
      }
    } catch (err) {
      console.error("Toggle error:", err);
    }
  }

  // Stats
  const activeCount = templates.filter((t) => t.is_active).length;
  const tradeCount = new Set(templates.map((t) => t.trade)).size;

  if (loading || tradesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-[#fa432a]" />
            Anfrage-Vorlagen
          </h1>
          <p className="text-neutral-400 mt-1">
            {templates.length} Vorlagen · {activeCount} aktiv · {tradeCount} Gewerke
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Neue Vorlage
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen..."
            className="input w-full pl-10"
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showInactive
              ? "bg-[#fa432a]/20 border border-[#fa432a] text-[#fa432a]"
              : "bg-[#1a1a1a] border border-[#262626] text-neutral-400 hover:text-white"
          }`}
        >
          {showInactive ? "Inaktive ausblenden" : "Inaktive anzeigen"}
        </button>
      </div>

      {/* Templates grouped by trade */}
      {sortedTrades.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Vorlagen gefunden</p>
          <p className="text-neutral-500 text-sm mt-1">
            Erstelle eine neue Vorlage um loszulegen.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedTrades.map((tradeSlug) => (
            <div key={tradeSlug}>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fa432a]" />
                {getTradeLabel(tradeSlug)}
                <span className="text-sm text-neutral-500 font-normal">
                  ({grouped[tradeSlug].length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {grouped[tradeSlug].map((template) => (
                  <div
                    key={template.id}
                    className={`bg-[#111] border rounded-xl p-4 transition-colors ${
                      template.is_active
                        ? "border-[#1a1a1a] hover:border-[#262626]"
                        : "border-[#1a1a1a] opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-medium text-white leading-tight">{template.name}</h3>
                      {template.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 shrink-0">
                          <CheckCircle className="w-3 h-3" />
                          Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-400 shrink-0">
                          <XCircle className="w-3 h-3" />
                          Inaktiv
                        </span>
                      )}
                    </div>

                    {template.description && (
                      <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-sm text-neutral-500 mb-4">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {template.fields.length} Felder
                      </span>
                      {template.fields.filter((f) => f.required).length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-[#fa432a]">*</span>
                          {template.fields.filter((f) => f.required).length} Pflicht
                        </span>
                      )}
                    </div>

                    {/* Field type badges */}
                    {template.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {Object.entries(
                          template.fields.reduce<Record<string, number>>((acc, f) => {
                            acc[f.type] = (acc[f.type] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([type, count]) => {
                          const info = FIELD_TYPE_LABELS[type];
                          return (
                            <span
                              key={type}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#1a1a1a] text-neutral-400"
                            >
                              {info && <info.icon className="w-3 h-3" />}
                              {count}x {info?.label || type}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-[#1a1a1a]">
                      <button
                        onClick={() => openEdit(template)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[#1a1a1a] text-neutral-300 hover:text-white transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => toggleActive(template)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          template.is_active
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        }`}
                      >
                        {template.is_active ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Deaktivieren
                          </>
                        ) : (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            Aktivieren
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={form.id ? "Vorlage bearbeiten" : "Neue Vorlage"}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Trade */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Gewerk *</label>
            <select
              value={form.trade}
              onChange={(e) => setForm({ ...form, trade: e.target.value })}
              className="input w-full"
              required
            >
              <option value="">Gewerk auswahlen...</option>
              {trades
                .filter((t) => t.is_active !== false)
                .map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.label}
                  </option>
                ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="z.B. DC-Montage Checkliste"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Beschreibung</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input w-full"
              placeholder="Optionale Beschreibung der Vorlage..."
              rows={2}
            />
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm text-neutral-400">
                Felder ({form.fields.length})
              </label>
              {editingFieldIndex === null && (
                <button
                  type="button"
                  onClick={startAddField}
                  className="flex items-center gap-1.5 text-sm text-[#fa432a] hover:text-[#ff6b4a] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Feld hinzufugen
                </button>
              )}
            </div>

            {/* Field list */}
            {form.fields.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg px-3 py-2"
                  >
                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveField(index, "up")}
                        disabled={index === 0}
                        className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(index, "down")}
                        disabled={index === form.fields.length - 1}
                        className="p-0.5 text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Field info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">
                          {field.label}
                        </span>
                        {field.required && (
                          <span className="text-[#fa432a] text-xs">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[#1a1a1a] text-neutral-400">
                          {FIELD_TYPE_LABELS[field.type]?.label || field.type}
                        </span>
                        {field.group && (
                          <span className="text-xs text-neutral-500">
                            Gruppe: {field.group}
                          </span>
                        )}
                        <span className="text-xs text-neutral-600 font-mono">
                          {field.key}
                        </span>
                      </div>
                    </div>

                    {/* Edit / Delete */}
                    <button
                      type="button"
                      onClick={() => startEditField(index)}
                      className="p-1.5 text-neutral-500 hover:text-white transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit field form */}
            {editingFieldIndex !== null && (
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-medium text-white">
                  {editingFieldIndex === -1 ? "Neues Feld" : "Feld bearbeiten"}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Label */}
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Label *</label>
                    <input
                      type="text"
                      value={fieldDraft.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        setFieldDraft({
                          ...fieldDraft,
                          label,
                          key: toSnakeCase(label),
                        });
                      }}
                      className="input w-full"
                      placeholder="z.B. Modultyp"
                    />
                  </div>

                  {/* Key (auto-generated) */}
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Key (auto)</label>
                    <input
                      type="text"
                      value={fieldDraft.key}
                      onChange={(e) =>
                        setFieldDraft({ ...fieldDraft, key: e.target.value })
                      }
                      className="input w-full font-mono text-neutral-500"
                      placeholder="auto_generated"
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Typ</label>
                    <select
                      value={fieldDraft.type}
                      onChange={(e) =>
                        setFieldDraft({
                          ...fieldDraft,
                          type: e.target.value as InquiryTemplateField["type"],
                        })
                      }
                      className="input w-full"
                    >
                      {Object.entries(FIELD_TYPE_LABELS).map(([value, { label }]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Group */}
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Gruppe (optional)</label>
                    <input
                      type="text"
                      value={fieldDraft.group || ""}
                      onChange={(e) =>
                        setFieldDraft({ ...fieldDraft, group: e.target.value })
                      }
                      className="input w-full"
                      placeholder="z.B. Technische Daten"
                    />
                  </div>
                </div>

                {/* Required checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldDraft.required || false}
                    onChange={(e) =>
                      setFieldDraft({ ...fieldDraft, required: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-[#262626] bg-[#111] text-[#fa432a] focus:ring-[#fa432a]"
                  />
                  <span className="text-sm text-neutral-300">Pflichtfeld</span>
                </label>

                {/* Options (for select type) */}
                {fieldDraft.type === "select" && (
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Optionen</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(fieldDraft.options || []).map((opt, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-[#1a1a1a] text-neutral-300"
                        >
                          {opt}
                          <button
                            type="button"
                            onClick={() => removeOption(i)}
                            className="text-neutral-500 hover:text-red-400 transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addOption();
                          }
                        }}
                        className="input flex-1"
                        placeholder="Option hinzufugen..."
                      />
                      <button
                        type="button"
                        onClick={addOption}
                        className="px-3 py-1.5 text-sm rounded-lg bg-[#1a1a1a] text-neutral-300 hover:text-white transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Field form actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={cancelFieldEdit}
                    className="btn-secondary text-sm px-4 py-1.5"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={saveField}
                    disabled={!fieldDraft.label.trim()}
                    className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
                  >
                    {editingFieldIndex === -1 ? "Hinzufugen" : "Ubernehmen"}
                  </button>
                </div>
              </div>
            )}

            {/* Empty fields state */}
            {form.fields.length === 0 && editingFieldIndex === null && (
              <div className="text-center py-6 bg-[#0a0a0a] border border-dashed border-[#262626] rounded-xl">
                <FileText className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
                <p className="text-sm text-neutral-500">Noch keine Felder definiert</p>
                <button
                  type="button"
                  onClick={startAddField}
                  className="text-sm text-[#fa432a] hover:text-[#ff6b4a] mt-2 transition-colors"
                >
                  Erstes Feld hinzufugen
                </button>
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="flex gap-3 pt-4 border-t border-[#1a1a1a]">
            <button
              type="button"
              onClick={closeForm}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving || !form.name.trim() || !form.trade}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving && <Spinner className="w-5 h-5" />}
              Speichern
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
