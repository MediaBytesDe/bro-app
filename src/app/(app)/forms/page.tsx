"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Copy,
  ChevronRight,
  GripVertical,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Image,
  PenTool,
  ToggleLeft,
} from "lucide-react";

interface FormField {
  id: string;
  type: "text" | "number" | "date" | "checkbox" | "select" | "textarea" | "photo" | "signature" | "toggle";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // for select
}

interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  form_type: string;
  fields: FormField[];
  brand_ids: string[];
  is_active: boolean;
  requires_signature: boolean;
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

const fieldTypes = [
  { type: "text", label: "Text", icon: Type },
  { type: "textarea", label: "Textfeld", icon: FileText },
  { type: "number", label: "Zahl", icon: Hash },
  { type: "date", label: "Datum", icon: Calendar },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "select", label: "Auswahl", icon: List },
  { type: "toggle", label: "Ja/Nein", icon: ToggleLeft },
  { type: "photo", label: "Foto", icon: Image },
  { type: "signature", label: "Unterschrift", icon: PenTool },
];

export default function FormsPage() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    form_type: "custom",
    fields: [] as FormField[],
    brand_ids: [] as string[],
    requires_signature: false,
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [templatesRes, brandsRes] = await Promise.all([
        supabase.from("form_templates").select("*").eq("is_active", true).order("name"),
        supabase.from("projects").select("id, name, slug").is("parent_id", null).order("name"),
      ]);
      
      setTemplates(templatesRes.data || []);
      setBrands(brandsRes.data || []);
    } catch (err) {
      console.error("Error loading forms:", err);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingTemplate(null);
    setForm({
      name: "",
      description: "",
      form_type: "custom",
      fields: [],
      brand_ids: [],
      requires_signature: false,
    });
    setShowModal(true);
  }

  function openEdit(template: FormTemplate) {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      description: template.description || "",
      form_type: template.form_type,
      fields: template.fields || [],
      brand_ids: template.brand_ids || [],
      requires_signature: template.requires_signature,
    });
    setShowModal(true);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (form.fields.length === 0) {
      alert("Bitte mindestens ein Feld hinzufügen");
      return;
    }
    
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      form_type: form.form_type,
      fields: form.fields,
      brand_ids: form.brand_ids,
      requires_signature: form.requires_signature,
    };

    let error;
    if (editingTemplate) {
      ({ error } = await supabase.from("form_templates").update(payload).eq("id", editingTemplate.id));
    } else {
      ({ error } = await supabase.from("form_templates").insert(payload));
    }

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowModal(false);
    loadData();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Formular wirklich löschen?")) return;
    
    await supabase.from("form_templates").update({ is_active: false }).eq("id", id);
    loadData();
  }

  async function duplicateTemplate(template: FormTemplate) {
    await supabase.from("form_templates").insert({
      name: template.name + " (Kopie)",
      description: template.description,
      form_type: template.form_type,
      fields: template.fields,
      brand_ids: template.brand_ids,
      requires_signature: template.requires_signature,
    });
    loadData();
  }

  function addField(type: FormField["type"]) {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type,
      label: "",
      required: false,
      ...(type === "select" ? { options: ["Option 1", "Option 2"] } : {}),
    };
    setForm({ ...form, fields: [...form.fields, newField] });
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setForm({
      ...form,
      fields: form.fields.map(f => f.id === id ? { ...f, ...updates } : f),
    });
  }

  function removeField(id: string) {
    setForm({ ...form, fields: form.fields.filter(f => f.id !== id) });
  }

  function moveField(index: number, direction: "up" | "down") {
    const newFields = [...form.fields];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newFields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setForm({ ...form, fields: newFields });
  }

  function toggleBrand(brandId: string) {
    const newBrandIds = form.brand_ids.includes(brandId)
      ? form.brand_ids.filter(id => id !== brandId)
      : [...form.brand_ids, brandId];
    setForm({ ...form, brand_ids: newBrandIds });
  }

  const getFieldIcon = (type: string) => {
    const ft = fieldTypes.find(f => f.type === type);
    return ft ? ft.icon : Type;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-400" />
          Formulare
        </h1>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neues Formular
        </button>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-8 text-center">
          <FileText className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
          <p className="text-neutral-500">Noch keine Formulare erstellt</p>
          <button onClick={openNew} className="btn btn-primary btn-sm mt-4">
            <Plus className="w-4 h-4" /> Erstes Formular erstellen
          </button>
        </div>
      ) : (
        <div className="card divide-y divide-neutral-800">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between p-4 hover:bg-neutral-800/50 transition-colors group"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{template.name}</h3>
                  {template.requires_signature && (
                    <span title="Unterschrift erforderlich"><PenTool className="w-4 h-4 text-orange-400" /></span>
                  )}
                </div>
                {template.description && (
                  <p className="text-sm text-neutral-500">{template.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-neutral-600">{template.fields.length} Felder</span>
                  {template.brand_ids.length > 0 && (
                    <span className="text-xs text-neutral-600">
                      • {template.brand_ids.length} Marken
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => duplicateTemplate(template)}
                  className="btn btn-ghost btn-sm"
                  title="Duplizieren"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEdit(template)}
                  className="btn btn-ghost btn-sm"
                  title="Bearbeiten"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="btn btn-ghost btn-sm text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Builder Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? "Formular bearbeiten" : "Neues Formular"}
        size="lg"
      >
        <form onSubmit={saveTemplate} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input
                type="text"
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="z.B. Aufnahmebogen PV"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="label">Beschreibung</label>
              <input
                type="text"
                className="input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Kurze Beschreibung des Formulars"
              />
            </div>
          </div>

          {/* Brands */}
          <div>
            <label className="label">Verfügbar für Marken</label>
            <div className="flex flex-wrap gap-2">
              {brands.map((brand) => (
                <button
                  key={brand.id}
                  type="button"
                  onClick={() => toggleBrand(brand.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    form.brand_ids.includes(brand.id)
                      ? "bg-orange-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                  }`}
                >
                  {brand.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Keine Auswahl = für alle Marken verfügbar
            </p>
          </div>

          {/* Signature Required */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requires_signature}
              onChange={(e) => setForm({ ...form, requires_signature: e.target.checked })}
              className="w-4 h-4 rounded border-neutral-600 text-orange-500 focus:ring-orange-500"
            />
            <span className="text-sm text-neutral-300">Unterschrift erforderlich</span>
          </label>

          {/* Field Types */}
          <div>
            <label className="label">Feld hinzufügen</label>
            <div className="flex flex-wrap gap-2">
              {fieldTypes.map((ft) => (
                <button
                  key={ft.type}
                  type="button"
                  onClick={() => addField(ft.type as FormField["type"])}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition-colors"
                >
                  <ft.icon className="w-4 h-4" />
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fields List */}
          <div>
            <label className="label">Felder ({form.fields.length})</label>
            {form.fields.length === 0 ? (
              <div className="border border-dashed border-neutral-700 rounded-lg p-6 text-center text-neutral-500">
                Klicke oben auf einen Feldtyp um Felder hinzuzufügen
              </div>
            ) : (
              <div className="space-y-2">
                {form.fields.map((field, index) => {
                  const FieldIcon = getFieldIcon(field.type);
                  return (
                    <div
                      key={field.id}
                      className="flex items-start gap-2 p-3 bg-neutral-800/50 rounded-lg"
                    >
                      <div className="flex flex-col gap-1 pt-2">
                        <button
                          type="button"
                          onClick={() => moveField(index, "up")}
                          disabled={index === 0}
                          className="text-neutral-500 hover:text-white disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(index, "down")}
                          disabled={index === form.fields.length - 1}
                          className="text-neutral-500 hover:text-white disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                      <FieldIcon className="w-5 h-5 text-neutral-500 mt-2.5 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          className="input"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder="Feldbezeichnung"
                        />
                        {field.type === "select" && (
                          <input
                            type="text"
                            className="input text-sm"
                            value={field.options?.join(", ") || ""}
                            onChange={(e) => updateField(field.id, { options: e.target.value.split(",").map(s => s.trim()) })}
                            placeholder="Optionen (kommagetrennt)"
                          />
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            className="w-3 h-3 rounded"
                          />
                          <span className="text-xs text-neutral-500">Pflichtfeld</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeField(field.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-neutral-800">
            <div>
              {editingTemplate && (
                <button
                  type="button"
                  onClick={() => { deleteTemplate(editingTemplate.id); setShowModal(false); }}
                  className="btn btn-ghost text-red-400"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Spinner /> : "Speichern"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
