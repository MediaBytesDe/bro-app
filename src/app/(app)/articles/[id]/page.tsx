"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Product, formatCurrency } from "@/types/wawi";
import {
  ArrowLeft,
  Save,
  Trash2,
  Package,
  Euro,
  Calculator,
  ChevronDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { LiveCalculation } from "@/components/live-calculation";

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const isNew = params.id === "new";
  
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Partial<Product>>({
    name: "",
    sku: "",
    category: "",
    manufacturer: "",
    description: "",
    unit: "Stück",
    standard_quantity: 1,
    purchase_list_price: 0,
    supplier_discount: 0,
    supplier_skonto: 0,
    purchase_costs: 0,
    overhead_percentage: 25,
    profit_margin: 30,
    customer_skonto: 0,
    default_customer_discount: 0,
    tax_rate: 0,
    stock_quantity: 0,
    min_stock_level: 10,
    status: "active",
  });

  useEffect(() => {
    loadCategories();
    if (!isNew && params.id) {
      loadProduct(params.id as string);
    }
  }, [params.id, isNew]);

  async function loadCategories() {
    const { data } = await supabase
      .from("product_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (data) setCategories(data);
  }

  async function loadProduct(id: string) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        toast.error("Artikel nicht gefunden");
        router.push("/articles");
        return;
      }

      setProduct(data);
    } catch (err) {
      console.error("Error loading product:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate all prices
  const calculatePrices = useCallback((p: Partial<Product>) => {
    const listPrice = p.purchase_list_price || 0;
    const discount = p.supplier_discount || 0;
    const skonto = p.supplier_skonto || 0;
    const costs = p.purchase_costs || 0;
    const overhead = p.overhead_percentage || 0;
    const margin = p.profit_margin || 0;
    const customerDiscount = p.default_customer_discount || 0;
    const taxRate = p.tax_rate || 0;

    // Einkaufspreise
    const targetPurchasePrice = listPrice * (1 - discount / 100);
    const barePurchasePrice = targetPurchasePrice * (1 - skonto / 100);
    const referencePrice = barePurchasePrice + costs;
    
    // Selbstkosten
    const costPrice = referencePrice * (1 + overhead / 100);
    
    // Verkaufspreise
    const bareSellingPrice = costPrice * (1 + margin / 100);
    const targetSellingPrice = bareSellingPrice * (1 - customerDiscount / 100);
    const netSellingPrice = targetSellingPrice;
    const grossSellingPrice = netSellingPrice * (1 + taxRate / 100);

    return {
      target_purchase_price: targetPurchasePrice,
      bare_purchase_price: barePurchasePrice,
      reference_price: referencePrice,
      cost_price: costPrice,
      bare_selling_price: bareSellingPrice,
      target_selling_price: targetSellingPrice,
      net_selling_price: netSellingPrice,
      gross_selling_price: grossSellingPrice,
    };
  }, []);

  // Update field and recalculate
  function updateField(field: keyof Product, value: any) {
    setProduct(prev => {
      const updated = { ...prev, [field]: value };
      const prices = calculatePrices(updated);
      return { ...updated, ...prices };
    });
  }

  async function handleSave() {
    if (!product.name || !product.sku) {
      toast.error("Name und SKU sind Pflichtfelder");
      return;
    }

    setSaving(true);
    const prices = calculatePrices(product);
    const data = { ...product, ...prices, updated_at: new Date().toISOString() };

    if (isNew) {
      const { error } = await supabase.from("products").insert(data);
      if (error) {
        toast.error("Fehler beim Erstellen: " + error.message);
      } else {
        toast.success("Artikel erstellt");
        router.push("/articles");
      }
    } else {
      const { error } = await supabase
        .from("products")
        .update(data)
        .eq("id", params.id);
      if (error) {
        toast.error("Fehler beim Speichern: " + error.message);
      } else {
        toast.success("Artikel gespeichert");
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Artikel wirklich löschen?")) return;

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", params.id);

    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Artikel gelöscht");
      router.push("/articles");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  const prices = calculatePrices(product);

  return (
    <div className="pb-24 pt-16">
      {/* Header - fixed */}
      <div className="fixed top-14 left-0 right-0 z-20 flex items-center gap-4 bg-[#0a0a0a] py-3 px-4 border-b border-neutral-800/50">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">
            {isNew ? "Neuer Artikel" : "Artikel bearbeiten"}
          </h1>
          {product.sku && (
            <p className="text-sm text-neutral-500 font-mono">{product.sku}</p>
          )}
        </div>
        {!isNew && (
          <button
            onClick={handleDelete}
            className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        )}
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Eingabefelder */}
        <div className="flex-1 space-y-6">

      {/* Stammdaten */}
      <Section title="Stammdaten" icon={<Package className="w-4 h-4" />}>
        <div className="grid gap-4">
          <Input
            label="Artikelname"
            value={product.name || ""}
            onChange={(v) => updateField("name", v)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={product.sku || ""}
              onChange={(v) => updateField("sku", v)}
              required
            />
            <CategorySelect
              label="Kategorie"
              categories={categories}
              value={product.category || ""}
              onChange={(name) => {
                updateField("category", name);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Hersteller"
              value={product.manufacturer || ""}
              onChange={(v) => updateField("manufacturer", v)}
            />
            <Input
              label="Einheit"
              value={product.unit || ""}
              onChange={(v) => updateField("unit", v)}
            />
          </div>
          <Textarea
            label="Beschreibung"
            value={product.description || ""}
            onChange={(v) => updateField("description", v)}
          />
        </div>
      </Section>

      {/* Einkauf */}
      <Section title="Einkauf" icon={<Euro className="w-4 h-4" />}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Listenpreis"
              value={product.purchase_list_price || 0}
              onChange={(v) => updateField("purchase_list_price", v)}
              suffix="€"
            />
            <NumberInput
              label="Lieferantenrabatt"
              value={product.supplier_discount || 0}
              onChange={(v) => updateField("supplier_discount", v)}
              suffix="%"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Skonto"
              value={product.supplier_skonto || 0}
              onChange={(v) => updateField("supplier_skonto", v)}
              suffix="%"
            />
            <NumberInput
              label="Bezugsnebenkosten"
              value={product.purchase_costs || 0}
              onChange={(v) => updateField("purchase_costs", v)}
              suffix="€"
            />
          </div>
        </div>
      </Section>

      {/* Kalkulation */}
      <Section title="Kalkulation" icon={<Calculator className="w-4 h-4" />}>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Gemeinkosten"
              value={product.overhead_percentage || 0}
              onChange={(v) => updateField("overhead_percentage", v)}
              suffix="%"
            />
            <NumberInput
              label="Gewinnzuschlag"
              value={product.profit_margin || 0}
              onChange={(v) => updateField("profit_margin", v)}
              suffix="%"
              highlight
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberInput
              label="Kundenskonto"
              value={product.customer_skonto || 0}
              onChange={(v) => updateField("customer_skonto", v)}
              suffix="%"
            />
            <NumberInput
              label="Kundenrabatt"
              value={product.default_customer_discount || 0}
              onChange={(v) => updateField("default_customer_discount", v)}
              suffix="%"
            />
          </div>
          <NumberInput
            label="MwSt."
            value={product.tax_rate || 0}
            onChange={(v) => updateField("tax_rate", v)}
            suffix="%"
          />
        </div>
      </Section>

      {/* Lager */}
      {/* Lager */}
      <Section title="Lager" icon={<Package className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-4">
          <NumberInput
            label="Bestand"
            value={product.stock_quantity || 0}
            onChange={(v) => updateField("stock_quantity", v)}
            suffix="Stk"
            integer
          />
          <NumberInput
            label="Mindestbestand"
            value={product.min_stock_level || 0}
            onChange={(v) => updateField("min_stock_level", v)}
            suffix="Stk"
            integer
          />
        </div>
      </Section>

        </div>
        {/* Ende linke Spalte */}

        {/* Rechte Spalte: Live-Kalkulation (sticky) */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0 hidden lg:block self-start sticky top-36">
          <LiveCalculation
            purchaseListPrice={product.purchase_list_price || 0}
            supplierDiscount={product.supplier_discount || 0}
            supplierSkonto={product.supplier_skonto || 0}
            purchaseCosts={product.purchase_costs || 0}
            overheadPercentage={product.overhead_percentage || 0}
            profitMargin={product.profit_margin || 0}
            customerSkonto={product.customer_skonto || 0}
            customerDiscount={product.default_customer_discount || 0}
            taxRate={product.tax_rate || 0}
          />
        </div>
      </div>
      {/* Ende 2-Column Layout */}

      {/* Mobile: Live-Kalkulation unten */}
      <div className="lg:hidden mt-6">
        <LiveCalculation
          purchaseListPrice={product.purchase_list_price || 0}
          supplierDiscount={product.supplier_discount || 0}
          supplierSkonto={product.supplier_skonto || 0}
          purchaseCosts={product.purchase_costs || 0}
          overheadPercentage={product.overhead_percentage || 0}
          profitMargin={product.profit_margin || 0}
          customerSkonto={product.customer_skonto || 0}
          customerDiscount={product.default_customer_discount || 0}
          taxRate={product.tax_rate || 0}
        />
      </div>

      {/* Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#fa432a] to-[#ff6b4a] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? (
            <Spinner className="w-5 h-5" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Speichern
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Section Component
function Section({ title, icon, children }: { 
  title: string; 
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-neutral-500">{icon}</span>
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// Input Components
function Input({ label, value, onChange, required }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fa432a]/50 transition-colors"
      />
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix, integer, highlight }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  integer?: boolean;
  highlight?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          step={integer ? "1" : "0.01"}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full px-4 py-3 rounded-xl bg-neutral-900 border text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fa432a]/50 transition-colors ${
            highlight ? "border-green-500/30" : "border-neutral-800"
          } ${suffix ? "pr-12" : ""}`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#fa432a]/50 transition-colors resize-none"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-[#fa432a]/50 transition-colors appearance-none cursor-pointer"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function CalcResult({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-neutral-800/50 border border-neutral-700/50">
      <span className="block text-xs text-neutral-500 mb-0.5">{label}</span>
      <span className="text-lg font-semibold text-white font-mono">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function CategorySelect({ label, categories, value, onChange }: {
  label: string;
  categories: Category[];
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build tree structure
  const mainCats = categories.filter(c => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const subCats = categories.filter(c => c.parent_id);

  const tree = mainCats.map(main => ({
    ...main,
    children: subCats.filter(s => s.parent_id === main.id).sort((a, b) => a.sort_order - b.sort_order)
  }));

  // Find current category by name for display
  const current = categories.find(c => c.name === value);
  const parent = current?.parent_id ? categories.find(c => c.id === current.parent_id) : null;
  const displayName = current
    ? (parent ? `${parent.name} → ${current.name}` : current.name)
    : value || "Kategorie wählen...";

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleSelect = (cat: Category) => {
    onChange(cat.name);
    setOpen(false);
  };

  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-left text-white focus:outline-none focus:border-[#fa432a]/50 transition-colors flex items-center justify-between"
      >
        <span className={current ? "text-white" : "text-neutral-500"}>
          {displayName}
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-500" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#111] border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="font-medium text-white">Kategorie wählen</h3>
              <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tree */}
            <div className="max-h-80 overflow-y-auto p-2">
              {tree.map(main => (
                <div key={main.id} className="mb-1">
                  {/* Main Category */}
                  <div className="flex items-center">
                    {main.children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleExpand(main.id)}
                        className="p-1.5 hover:bg-neutral-800 rounded-lg"
                      >
                        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${expanded.has(main.id) ? '' : '-rotate-90'}`} />
                      </button>
                    ) : (
                      <div className="w-7" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelect(main)}
                      className={`flex-1 px-3 py-2 rounded-lg text-left text-sm font-medium transition-colors ${
                        value === main.name
                          ? 'bg-[#fa432a]/20 text-[#fa432a]'
                          : 'text-white hover:bg-neutral-800'
                      }`}
                    >
                      {main.name}
                    </button>
                  </div>

                  {/* Subcategories */}
                  {expanded.has(main.id) && main.children.length > 0 && (
                    <div className="ml-7 mt-1 space-y-0.5">
                      {main.children.map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSelect(sub)}
                          className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            value === sub.name
                              ? 'bg-[#fa432a]/20 text-[#fa432a]'
                              : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
