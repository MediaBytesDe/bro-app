"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Copy,
  FileText,
  Package,
  GripVertical,
  ChevronRight,
  Search,
  X,
  Settings,
  Tag,
} from "lucide-react";
import type { QuoteTemplate, QuoteTemplateItem, Product } from "@/types/wawi";
import { formatCurrency, PRODUCT_CATEGORIES } from "@/types/wawi";

type TemplateCategory = {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
};

export default function QuoteTemplatesPage() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [templatesRes, categoriesRes] = await Promise.all([
        supabase.from("quote_templates").select("*").order("sort_order"),
        supabase.from("quote_template_categories").select("*").order("sort_order"),
      ]);
      setTemplates(templatesRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    const { data } = await supabase
      .from("quote_templates")
      .select("*")
      .order("sort_order");
    setTemplates(data || []);
  }

  async function loadCategories() {
    const { data } = await supabase
      .from("quote_template_categories")
      .select("*")
      .order("sort_order");
    setCategories(data || []);
  }

  function openNew() {
    setEditingTemplate(null);
    setShowEditor(true);
  }

  function openEdit(template: QuoteTemplate) {
    setEditingTemplate(template);
    setShowEditor(true);
  }

  async function duplicateTemplate(template: QuoteTemplate) {
    const { error } = await supabase.from("quote_templates").insert({
      name: `${template.name} (Kopie)`,
      description: template.description,
      category: template.category,
      items: template.items,
      introduction_text: template.introduction_text,
      footer_text: template.footer_text,
      is_active: true,
      sort_order: templates.length,
    });
    if (!error) loadTemplates();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Template wirklich löschen?")) return;
    await supabase.from("quote_templates").delete().eq("id", id);
    loadTemplates();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/quotes")}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#111] border border-[#1a1a1a] text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Angebotsvorlagen</h1>
          <p className="text-sm text-neutral-500">Standardangebote für wiederkehrende Aufträge</p>
        </div>
        <button 
          onClick={() => setShowCategories(true)} 
          className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl text-neutral-400 hover:text-white hover:border-[#333] transition-colors"
        >
          <Tag className="w-4 h-4" />
          <span className="hidden md:inline text-sm">Kategorien</span>
        </button>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neue Vorlage
        </button>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="p-12 bg-[#111] border border-dashed border-[#333] rounded-2xl text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-neutral-600" />
          <h3 className="text-lg font-semibold text-white mb-2">Keine Vorlagen</h3>
          <p className="text-neutral-500 mb-6 max-w-md mx-auto">
            Erstelle Angebotsvorlagen für wiederkehrende Angebote wie "PV 10kWp Standard" oder "Wallbox Paket"
          </p>
          <button onClick={openNew} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            Erste Vorlage erstellen
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onDuplicate={() => duplicateTemplate(template)}
              onDelete={() => deleteTemplate(template.id)}
              onUse={() => router.push(`/quotes/new?template=${template.id}`)}
            />
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <TemplateEditor
          template={editingTemplate}
          categories={categories}
          onClose={() => {
            setShowEditor(false);
            setEditingTemplate(null);
          }}
          onSave={() => {
            setShowEditor(false);
            setEditingTemplate(null);
            loadTemplates();
          }}
        />
      )}

      {/* Categories Modal */}
      <Modal 
        open={showCategories} 
        onClose={() => setShowCategories(false)} 
        title="Vorlagenkategorien"
      >
        <CategoriesEditor 
          onUpdate={loadCategories}
        />
      </Modal>
    </div>
  );
}

// Categories Editor Component
function CategoriesEditor({ 
  onUpdate 
}: { 
  onUpdate: () => void;
}) {
  const [items, setItems] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("quote_template_categories")
        .select("*")
        .order("sort_order");
      setItems(data || []);
    } catch (err) {
      console.error("Categories load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function addCategory() {
    if (!newName.trim()) return;
    setSaving(true);
    
    const slug = newName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    await supabase.from("quote_template_categories").insert({
      name: newName.trim(),
      slug,
      color: "#f97316",
      sort_order: items.length,
    });
    
    setNewName("");
    setSaving(false);
    loadCategories();
    onUpdate();
  }

  async function updateCategory(id: string, updates: Partial<TemplateCategory>) {
    await supabase.from("quote_template_categories").update(updates).eq("id", id);
    loadCategories();
    onUpdate();
  }

  async function deleteCategory(id: string) {
    if (!confirm("Kategorie wirklich löschen?")) return;
    await supabase.from("quote_template_categories").delete().eq("id", id);
    loadCategories();
    onUpdate();
  }

  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-4">
      {/* Add New */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Neue Kategorie..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
        />
        <button 
          onClick={addCategory} 
          disabled={saving || !newName.trim()}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.map((cat) => (
          <div 
            key={cat.id} 
            className="flex items-center gap-3 p-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl"
          >
            {/* Color Picker */}
            <div className="relative group">
              <div 
                className="w-8 h-8 rounded-lg cursor-pointer"
                style={{ backgroundColor: cat.color }}
              />
              <div className="absolute left-0 top-full mt-2 p-2 bg-[#111] border border-[#262626] rounded-lg hidden group-hover:flex gap-1 z-10">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => updateCategory(cat.id, { color: c })}
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Name */}
            <input
              type="text"
              className="flex-1 bg-transparent text-white font-medium focus:outline-none"
              value={cat.name}
              onChange={(e) => {
                setItems(items.map(i => i.id === cat.id ? { ...i, name: e.target.value } : i));
              }}
              onBlur={(e) => updateCategory(cat.id, { name: e.target.value })}
            />

            {/* Delete */}
            <button
              onClick={() => deleteCategory(cat.id)}
              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {loading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-neutral-500 py-4">Keine Kategorien vorhanden</p>
        ) : null}
      </div>
    </div>
  );
}

// Template Card
function TemplateCard({
  template,
  onEdit,
  onDuplicate,
  onDelete,
  onUse,
}: {
  template: QuoteTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUse: () => void;
}) {
  const itemCount = template.items?.length || 0;
  const totalEstimate = template.items?.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_price);
  }, 0) || 0;

  return (
    <div className="p-5 bg-[#111] border border-[#1a1a1a] rounded-2xl hover:border-[#262626] transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-neutral-500 mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        {!template.is_active && (
          <span className="px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400 rounded">Inaktiv</span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-neutral-400 mb-4">
        <span className="flex items-center gap-1.5">
          <Package className="w-4 h-4" />
          {itemCount} Positionen
        </span>
        <span>≈ {formatCurrency(totalEstimate)}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUse}
          className="flex-1 btn btn-primary btn-sm"
        >
          Verwenden
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onEdit} className="btn btn-ghost btn-sm btn-icon">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDuplicate} className="btn btn-ghost btn-sm btn-icon">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="btn btn-ghost btn-sm btn-icon text-red-400">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Template Editor (Full Screen Modal)
function TemplateEditor({
  template,
  categories,
  onClose,
  onSave,
}: {
  template: QuoteTemplate | null;
  categories: TemplateCategory[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [category, setCategory] = useState(template?.category || "");
  const [items, setItems] = useState<QuoteTemplateItem[]>(template?.items || []);
  const [introText, setIntroText] = useState(template?.introduction_text || "");
  const [footerText, setFooterText] = useState(template?.footer_text || "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("name");
    setProducts(data || []);
  }

  function addProduct(product: Product) {
    const newItem: QuoteTemplateItem = {
      product_id: product.id,
      product_name: product.name,
      product_description: product.description,
      sku: product.sku,
      quantity: product.standard_quantity || 1,
      quantity_per_kwp: null,
      unit: product.unit || "Stück",
      unit_price: product.net_selling_price || 0,
      price_per_kwp: null,
      tax_rate: product.tax_rate || 0,
      is_optional: false,
      is_required: false,
    };
    setItems([...items, newItem]);
    setShowProducts(false);
  }

  function addCustomItem() {
    const newItem: QuoteTemplateItem = {
      product_id: null,
      product_name: "Neue Position",
      product_description: null,
      sku: null,
      quantity: 1,
      quantity_per_kwp: null,
      unit: "Stück",
      unit_price: 0,
      price_per_kwp: null,
      tax_rate: 0,
      is_optional: false,
      is_required: false,
    };
    setItems([...items, newItem]);
  }

  function updateItem(index: number, updates: Partial<QuoteTemplateItem>) {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: "up" | "down") {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...items];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setItems(updated);
  }

  async function save() {
    if (!name.trim()) {
      alert("Bitte Namen eingeben");
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      items,
      introduction_text: introText || null,
      footer_text: footerText || null,
      is_active: isActive,
    };

    if (template?.id) {
      await supabase
        .from("quote_templates")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", template.id);
    } else {
      await supabase.from("quote_templates").insert({
        ...payload,
        sort_order: 0,
      });
    }

    setSaving(false);
    onSave();
  }

  const totalEstimate = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 glass border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#111] border border-[#1a1a1a] text-neutral-400">
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold text-white">
              {template ? "Vorlage bearbeiten" : "Neue Vorlage"}
            </h1>
          </div>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <Spinner className="!w-4 !h-4" /> : "Speichern"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 pb-20 space-y-6">
        {/* Basic Info */}
        <section className="p-5 bg-[#111] border border-[#1a1a1a] rounded-2xl space-y-4">
          <h2 className="font-semibold text-white">Grunddaten</h2>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                className="input"
                placeholder="z.B. PV 10kWp Standard"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kategorie</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Keine</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Kurze Beschreibung der Vorlage..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded bg-[#1a1a1a] border-[#333]"
            />
            Vorlage aktiv
          </label>
        </section>

        {/* Items */}
        <section className="p-5 bg-[#111] border border-[#1a1a1a] rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Positionen ({items.length})</h2>
            <div className="flex gap-2">
              <button onClick={addCustomItem} className="btn btn-ghost btn-sm">
                <Plus className="w-4 h-4" />
                Manuell
              </button>
              <button onClick={() => setShowProducts(true)} className="btn btn-primary btn-sm">
                <Package className="w-4 h-4" />
                Produkt
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-8 border border-dashed border-[#333] rounded-xl text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-neutral-600" />
              <p className="text-neutral-500 text-sm">Keine Positionen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <TemplateItemCard
                  key={index}
                  item={item}
                  index={index}
                  onUpdate={(updates) => updateItem(index, updates)}
                  onRemove={() => removeItem(index)}
                  onMoveUp={() => moveItem(index, "up")}
                  onMoveDown={() => moveItem(index, "down")}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="pt-4 border-t border-[#1a1a1a] flex justify-between items-center">
              <span className="text-neutral-400">Geschätzte Summe</span>
              <span className="text-xl font-bold text-orange-400">{formatCurrency(totalEstimate)}</span>
            </div>
          )}
        </section>

        {/* Texts */}
        <section className="p-5 bg-[#111] border border-[#1a1a1a] rounded-2xl space-y-4">
          <h2 className="font-semibold text-white">Angebots-Texte</h2>
          
          <div className="form-group">
            <label className="form-label">Einleitung</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Sehr geehrte Damen und Herren,..."
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fußtext</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Zahlungskonditionen, Gültigkeitsdauer..."
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
            />
          </div>
        </section>
      </div>

      {/* Products Modal */}
      <Modal open={showProducts} onClose={() => setShowProducts(false)} title="Produkt hinzufügen">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Suchen..."
              className="input pl-10"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>

          <select
            className="input"
            value={productCategory || ""}
            onChange={(e) => setProductCategory(e.target.value || null)}
          >
            <option value="">Alle Kategorien</option>
            {PRODUCT_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>

          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {products
              .filter((p) => {
                const matchesSearch = !productSearch || 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.sku.toLowerCase().includes(productSearch.toLowerCase());
                const matchesCat = !productCategory || p.category === productCategory;
                return matchesSearch && matchesCat;
              })
              .map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product)}
                  className="w-full p-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl text-left hover:border-[#333] transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{product.name}</h4>
                      <p className="text-xs text-neutral-500">{product.sku}</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-400">
                      {formatCurrency(product.net_selling_price)}
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Template Item Card
function TemplateItemCard({
  item,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  item: QuoteTemplateItem;
  index: number;
  onUpdate: (updates: Partial<QuoteTemplateItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const total = item.quantity * item.unit_price;

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-3 h-3 -rotate-90" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="w-5 h-5 flex items-center justify-center text-neutral-600 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-3 h-3 rotate-90" />
          </button>
        </div>
        
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="font-medium text-white text-sm truncate">{item.product_name}</div>
          <div className="text-xs text-neutral-500">
            {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {item.is_required && (
            <span className="px-1.5 py-0.5 text-[10px] bg-green-500/10 text-green-400 rounded">Pflicht</span>
          )}
          {item.is_optional && (
            <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 rounded">Optional</span>
          )}
          <span className="font-semibold text-white text-sm">{formatCurrency(total)}</span>
          <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="p-3 pt-0 border-t border-[#1a1a1a] space-y-3">
          <div className="form-group">
            <label className="form-label">Bezeichnung</label>
            <input
              type="text"
              className="input"
              value={item.product_name}
              onChange={(e) => onUpdate({ product_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="form-label">Menge</label>
              <input
                type="number"
                className="input text-center"
                value={item.quantity}
                onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Einheit</label>
              <input
                type="text"
                className="input text-center"
                value={item.unit}
                onChange={(e) => onUpdate({ unit: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Einzelpreis</label>
              <input
                type="number"
                className="input text-center"
                value={item.unit_price}
                onChange={(e) => onUpdate({ unit_price: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label">Menge pro kWp</label>
              <input
                type="number"
                className="input"
                placeholder="z.B. 2.27 für Module"
                value={item.quantity_per_kwp || ""}
                onChange={(e) => onUpdate({ quantity_per_kwp: parseFloat(e.target.value) || null })}
              />
              <p className="text-xs text-neutral-600 mt-1">Leer = feste Menge</p>
            </div>
            <div className="form-group">
              <label className="form-label">Preis pro kWp</label>
              <input
                type="number"
                className="input"
                placeholder="z.B. 171.77 für UK"
                value={item.price_per_kwp || ""}
                onChange={(e) => onUpdate({ price_per_kwp: parseFloat(e.target.value) || null })}
              />
              <p className="text-xs text-neutral-600 mt-1">Leer = fester Preis</p>
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={item.is_required}
                onChange={(e) => onUpdate({ is_required: e.target.checked, is_optional: false })}
                className="w-4 h-4 rounded bg-[#1a1a1a] border-[#333]"
              />
              Pflichtposition
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input
                type="checkbox"
                checked={item.is_optional}
                onChange={(e) => onUpdate({ is_optional: e.target.checked, is_required: false })}
                className="w-4 h-4 rounded bg-[#1a1a1a] border-[#333]"
              />
              Optional
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
