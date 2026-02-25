"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  X,
  FileStack,
  Send,
  FileText,
  ExternalLink,
  Save,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { Product } from "@/types/wawi";
import {
  WawiQuoteItem,
  QuoteTemplateItem,
  formatCurrency,
  formatNumber,
  roundToX99,
  calculateItemTotal,
} from "@/types/wawi";
import { ProductSelector } from "@/components/quote-editor/product-selector";
import { QuoteItemsList } from "@/components/quote-editor/quote-items-list";
import { QuoteSummary } from "@/components/quote-editor/quote-summary";

// Standard Schlussbemerkung mit dynamischem Absender
const getDefaultFooter = (senderName: string) => `Wir hoffen, dass unser Angebot Sie überzeugt und freuen uns auf Ihre Rückmeldung. Bei Fragen stehen wir Ihnen gerne telefonisch zur Verfügung.

Zahlungskonditionen: 50 % bei Materialanlieferung, 50 % nach Montage und Inbetriebnahme

Leistungserbringung: Die Montage- und Elektroarbeiten werden durch qualifizierte Fachbetriebe aus unserem Partnernetzwerk ausgeführt. BROjekt GmbH übernimmt die Projektkoordination, Planung und Kundenbetreuung. Für die handwerklichen Leistungen gelten die jeweiligen Vertragsbedingungen unserer Partnerbetriebe.

Angebotsgültigkeit: Aufgrund volatiler Märkte und kurzfristiger Preisänderungen bei unseren Lieferanten ist dieses Angebot zwei Wochen ab Angebotsdatum gültig.

Mehrwertsteuerbefreit gemäß § 12 Abs. 3 UStG.

Mit freundlichem Gruß
${senderName}`;

// Steuerarten
const TAX_TYPES = [
  { id: "pv", label: "Photovoltaik (0%)", rate: 0 },
  { id: "standard", label: "Standard (19%)", rate: 19 },
  { id: "reduced", label: "Ermäßigt (7%)", rate: 7 },
];

interface Props {
  quoteId?: string;
  templateId?: string;
  initialProjectId?: string;
  initialCustomerId?: string;
}

export function QuoteEditor({ quoteId, templateId, initialProjectId, initialCustomerId }: Props) {
  const { profile } = useAuth();
  const senderName = profile?.display_name || "André Freese";
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lexwareId, setLexwareId] = useState<string | null>(null);
  const [lexwareNumber, setLexwareNumber] = useState<string | null>(null);
  
  // Dialogs
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  // Quote Data
  const [items, setItems] = useState<WawiQuoteItem[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId || null);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [title, setTitle] = useState("Angebot");
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [taxType, setTaxType] = useState("pv");
  const [isPackageDeal, setIsPackageDeal] = useState(false);
  const [packageTitle, setPackageTitle] = useState(""); // Separate title for package position
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [introText, setIntroText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [notes, setNotes] = useState("");
  
  // State for template name if loaded from template
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);
  
  // Products Modal
  const [showProducts, setShowProducts] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  // Templates Modal
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  // Customers & Projects
  const [customers, setCustomers] = useState<any[]>([]);
  const [showCustomers, setShowCustomers] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);

  // Edit Item Modal
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editingPackage, setEditingPackage] = useState(false);
  const [packageDescription, setPackageDescription] = useState("");

  const router = useRouter();
  const supabase = createClient();
  
  // Calculate kWp and kWh from items for Komplettpaket title
  const calculateSystemSpecs = () => {
    let totalKwp = 0;
    let totalKwh = 0;
    
    items.forEach((item) => {
      const name = item.product_name.toLowerCase();
      const desc = (item.product_description || "").toLowerCase();
      
      // kWp from solar modules (Trina, Module, etc.)
      // Look for wattage in name like "440W", "445W"
      const wattMatch = name.match(/(\d+)\s*w(?:att)?/i);
      if (wattMatch && (name.includes("modul") || name.includes("trina") || name.includes("solar"))) {
        const watts = parseInt(wattMatch[1]);
        totalKwp += (item.quantity * watts) / 1000;
      }
      
      // kWh from storage (Speicher)
      // Look for kWh in name like "6,4kWh", "9.6 kWh", "SBR064"
      if (name.includes("speicher") || name.includes("sbr") || name.includes("batterie")) {
        const kwhMatch = name.match(/(\d+)[,.]?(\d*)\s*kwh/i);
        if (kwhMatch) {
          totalKwh += parseFloat(`${kwhMatch[1]}.${kwhMatch[2] || 0}`);
        } else {
          // SBR format: SBR064 = 6.4kWh, SBR096 = 9.6kWh
          const sbrMatch = name.match(/sbr0?(\d)(\d)/i);
          if (sbrMatch) {
            totalKwh += parseFloat(`${sbrMatch[1]}.${sbrMatch[2]}`);
          }
        }
      }
    });
    
    return { totalKwp, totalKwh };
  };
  
  // Auto-update package title and description when Komplettpaket is enabled
  useEffect(() => {
    if (isPackageDeal && items.length > 0) {
      const { totalKwp, totalKwh } = calculateSystemSpecs();

      // Auto-set package position title if empty or follows pattern
      const isDefaultPkgTitle = !packageTitle || packageTitle.startsWith("Photovoltaik-Komplettpaket");
      if (isDefaultPkgTitle && totalKwp > 0) {
        setPackageTitle(`Photovoltaik-Komplettpaket ${formatNumber(totalKwp)} kWp`);
      }

      // Auto-set description if empty or follows pattern
      const isDefaultDesc = !packageDescription || packageDescription.startsWith("inkl. Speicheroption");
      if (isDefaultDesc && totalKwh > 0) {
        setPackageDescription(`inkl. Speicheroption ${formatNumber(totalKwh)} kWh`);
      } else if (isDefaultDesc && totalKwh === 0) {
        setPackageDescription("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPackageDeal, items]);
  
  // Auto-generate introduction when customer is selected
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        // Build customer name
        let name = "";
        if (customer.first_name && customer.last_name) {
          name = `${customer.first_name} ${customer.last_name}`;
        } else if (customer.last_name) {
          name = customer.last_name;
        } else if (customer.company_name) {
          name = customer.company_name;
        }

        // Only auto-set if intro is empty or follows our pattern
        const isDefaultIntro = !introText || introText.startsWith("Sehr geehrte");
        if (isDefaultIntro && name) {
          setIntroText(`Sehr geehrte/r ${name},

vielen Dank für Ihr Interesse an unseren Produkten. Gerne unterbreite ich Ihnen folgendes Angebot:`);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customers]);
  
  // Set default footer with sender name
  useEffect(() => {
    if (!footerText && senderName) {
      setFooterText(getDefaultFooter(senderName));
    }
  }, [senderName]);

  useEffect(() => {
    loadData();
  }, [quoteId, templateId]);

  async function loadData() {
    setLoading(true);
    try {
      // Load Products
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("status", "active")
        .order("name");
      setProducts(prods || []);

      // Load Customers
      const { data: custs } = await supabase
        .from("customers")
        .select("id, company_name, first_name, last_name")
        .order("company_name");
      setCustomers(custs || []);

      // Load Projects
      const { data: projs } = await supabase
        .from("projects")
        .select("id, name, customer_id")
        .order("name");
      setProjects(projs || []);

      // Load Templates
      const { data: templs } = await supabase
        .from("quote_templates")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setTemplates(templs || []);

      // Load existing quote if editing
      if (quoteId) {
        const { data: quote } = await supabase
          .from("wawi_quotes")
          .select("*")
          .eq("id", quoteId)
          .single();

        if (quote) {
          setCustomerId(quote.customer_id);
          setProjectId(quote.project_id || null);
          setTitle(quote.title || "Angebot");
          setQuoteDate(quote.quote_date);
          setValidUntil(quote.valid_until || "");
          setTaxType(quote.tax_type || "pv");
          setIsPackageDeal(quote.is_package_deal || false);
          setPackageTitle(quote.package_title || "");
          setLexwareId(quote.lexware_quotation_id || null);
          setLexwareNumber(quote.lexware_quote_number || null);
          setGlobalDiscount(quote.discount_percentage || 0);
          setIntroText(quote.introduction || "");
          setFooterText(quote.remark || getDefaultFooter(senderName));
          setNotes(quote.internal_notes || "");

          const { data: quoteItems } = await supabase
            .from("wawi_quote_items")
            .select("*")
            .eq("quote_id", quoteId)
            .order("position_number");

          setItems(quoteItems?.map((item, i) => ({
            ...item,
            _id: `item-${i}-${Date.now()}`,
          })) || []);
        }
      } else if (templateId) {
        await loadTemplate(templateId);
      } else {
        // Default text für neue Angebote (Einleitung)
        setIntroText("Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihr Interesse an unseren Produkten. Gerne unterbreite ich Ihnen folgendes Angebot:");
      }
    } catch (err) {
      console.error("Quote editor load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplate(id: string) {
    const { data: template } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (!template) return;

    setLoadedTemplateName(template.name);
    setIntroText(template.introduction_text || introText);
    
    // Get all product IDs from template items
    const productIds = (template.items || [])
      .filter((item: QuoteTemplateItem) => item.product_id)
      .map((item: QuoteTemplateItem) => item.product_id);
    
    // Fetch CURRENT product data from database
    let currentProducts: Record<string, Product> = {};
    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);
      
      if (productsData) {
        currentProducts = productsData.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, Product>);
      }
    }
    
    // Convert template items to quote items with CURRENT prices
    const selectedTaxRate = TAX_TYPES.find(t => t.id === taxType)?.rate || 0;
    const templateItems: WawiQuoteItem[] = (template.items || []).map((item: QuoteTemplateItem, i: number) => {
      const currentProduct = item.product_id ? currentProducts[item.product_id] : null;
      
      const quoteItem: WawiQuoteItem = {
        _id: `item-${i}-${Date.now()}`,
        product_id: item.product_id,
        position_number: i + 1,
        product_name: currentProduct?.name || item.product_name,
        product_description: currentProduct?.description || item.product_description,
        sku: currentProduct?.sku || item.sku,
        quantity: item.quantity,
        unit: currentProduct?.unit || item.unit,
        purchase_price: currentProduct?.cost_price || currentProduct?.reference_price || 0,
        unit_price: currentProduct?.net_selling_price ?? item.unit_price,
        discount_percentage: 0,
        total_price: 0,
        tax_rate: selectedTaxRate,
        tax_amount: 0,
        margin_amount: 0,
        margin_percentage: 0,
        is_package_deal: false,
        show_price: true,
      };
      const calcs = calculateItemTotal(quoteItem);
      return { ...quoteItem, ...calcs };
    });
    setItems(templateItems);
    setShowTemplates(false);
  }

  // Add Product to Quote
  function addProduct(product: Product) {
    const selectedTaxRate = TAX_TYPES.find(t => t.id === taxType)?.rate || 0;
    const newItem: WawiQuoteItem = {
      _id: `item-${items.length}-${Date.now()}`,
      product_id: product.id,
      position_number: items.length + 1,
      product_name: product.name,
      product_description: product.description,
      sku: product.sku,
      quantity: product.standard_quantity || 1,
      unit: product.unit || "Stück",
      purchase_price: product.cost_price || product.reference_price || 0,
      unit_price: product.net_selling_price || 0,
      discount_percentage: 0,
      total_price: 0,
      tax_rate: selectedTaxRate,
      tax_amount: 0,
      margin_amount: 0,
      margin_percentage: 0,
      is_package_deal: false,
      show_price: true,
    };

    const calcs = calculateItemTotal(newItem);
    setItems([...items, { ...newItem, ...calcs }]);
    setShowProducts(false);
  }

  // Add Custom Item
  function addCustomItem() {
    const selectedTaxRate = TAX_TYPES.find(t => t.id === taxType)?.rate || 0;
    const newItem: WawiQuoteItem = {
      _id: `item-${items.length}-${Date.now()}`,
      product_id: null,
      position_number: items.length + 1,
      product_name: "Neue Position",
      product_description: "",
      sku: null,
      quantity: 1,
      unit: "Stück",
      purchase_price: 0,
      unit_price: 0,
      discount_percentage: 0,
      total_price: 0,
      tax_rate: selectedTaxRate,
      tax_amount: 0,
      margin_amount: 0,
      margin_percentage: 0,
      is_package_deal: false,
      show_price: true,
    };
    setItems([...items, newItem]);
  }

  // Update Item
  function updateItem(index: number, field: keyof WawiQuoteItem, value: any) {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    // Recalculate totals
    const calcs = calculateItemTotal(updated[index]);
    updated[index] = { ...updated[index], ...calcs };
    
    setItems(updated);
  }

  // Remove Item
  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index);
    updated.forEach((item, i) => {
      item.position_number = i + 1;
    });
    setItems(updated);
  }

  // Update tax rate for all items when tax type changes
  function handleTaxTypeChange(newTaxType: string) {
    setTaxType(newTaxType);
    const newRate = TAX_TYPES.find(t => t.id === newTaxType)?.rate || 0;
    const updated = items.map(item => {
      const updatedItem = { ...item, tax_rate: newRate };
      const calcs = calculateItemTotal(updatedItem);
      return { ...updatedItem, ...calcs };
    });
    setItems(updated);
  }

  // Calculate Totals - Memoized
  const calculations = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
    const discountAmount = subtotal * (globalDiscount / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = items.reduce((sum, item) => sum + item.tax_amount, 0) * (1 - globalDiscount / 100);

    // Package Deal: Aufrunden auf X.X99€
    const packagePrice = isPackageDeal ? roundToX99(afterDiscount) : afterDiscount;
    const packageSurcharge = packagePrice - afterDiscount; // Zuschlag (99-Endung)

    const total = (isPackageDeal ? packagePrice : afterDiscount) + taxAmount;
    const totalPurchase = items.reduce((sum, item) => sum + (item.purchase_price * item.quantity), 0);
    const profit = (isPackageDeal ? packagePrice : afterDiscount) - totalPurchase;
    // Marge = Gewinn / Verkaufspreis (echter Gewinnanteil am Umsatz)
    const effectiveSalesPrice = isPackageDeal ? packagePrice : afterDiscount;
    const profitPercentage = effectiveSalesPrice > 0 ? (profit / effectiveSalesPrice) * 100 : 0;
    const isRentable = profitPercentage >= 15; // 15% Mindestmarge

    return {
      subtotal,
      discountAmount,
      afterDiscount,
      taxAmount,
      packagePrice,
      packageSurcharge,
      total,
      totalPurchase,
      profit,
      profitPercentage,
      isRentable,
    };
  }, [items, globalDiscount, isPackageDeal]);

  const {
    subtotal,
    discountAmount,
    afterDiscount,
    taxAmount,
    packagePrice,
    packageSurcharge,
    total,
    profit,
    profitPercentage,
    isRentable,
  } = calculations;

  // Save Quote
  async function saveQuote() {
    setSaving(true);

    const quoteData = {
      customer_id: customerId,
      project_id: projectId,
      title,
      quote_date: quoteDate,
      valid_until: validUntil,
      tax_type: taxType,
      is_package_deal: isPackageDeal,
      package_title: isPackageDeal ? packageTitle : null,
      package_price: isPackageDeal ? packagePrice : null,
      package_surcharge: isPackageDeal ? packageSurcharge : null,
      status: "draft" as const,
      subtotal,
      discount_percentage: globalDiscount,
      discount_amount: discountAmount,
      tax_rate: TAX_TYPES.find(t => t.id === taxType)?.rate || 0,
      tax_amount: taxAmount,
      total_amount: total,
      total_margin: profit,
      margin_percentage: profitPercentage,
      introduction: introText,
      remark: footerText,
      internal_notes: notes,
    };

    // Build items array (strip _id - client-only field)
    const itemsToSave = items.map((item) => ({
      product_id: item.product_id || null,
      product_name: item.product_name,
      product_description: item.product_description,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit,
      purchase_price: item.purchase_price,
      unit_price: item.unit_price,
      discount_percentage: isPackageDeal ? 0 : (item.discount_percentage || 0),
      total_price: isPackageDeal ? item.quantity * item.unit_price : item.total_price,
      tax_rate: item.tax_rate,
      tax_amount: item.tax_amount || 0,
      margin_amount: item.margin_amount || 0,
      margin_percentage: item.margin_percentage || 0,
      is_package_deal: false,
    }));

    try {
      const res = await fetch("/api/quotes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, quoteData, items: itemsToSave }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Error saving quote:", result.error);
        setToastMessage({ type: "error", text: `Fehler: ${result.error}` });
        setSaving(false);
        return;
      }

      setSaving(false);
      router.push("/quotes");
    } catch (err) {
      console.error("Error saving quote:", err);
      setToastMessage({ type: "error", text: `Fehler beim Speichern: ${String(err)}` });
      setSaving(false);
    }
  }

  async function exportToLexware() {
    if (!quoteId) {
      setToastMessage({ type: "error", text: "Bitte speichere das Angebot zuerst." });
      return;
    }

    if (!customerId) {
      setToastMessage({ type: "error", text: "Bitte wähle einen Kunden aus." });
      return;
    }

    setExporting(true);
    try {
      const response = await fetch("/api/lexware/export-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Export fehlgeschlagen");
      }

      setToastMessage({ type: "success", text: result.message });
      
      // Update local state
      setLexwareId(result.lexwareId);
      setLexwareNumber(result.lexwareNumber);
    } catch (error: any) {
      console.error("Lexware export error:", error);
      setToastMessage({ type: "error", text: error.message });
    } finally {
      setExporting(false);
    }
  }

  async function deleteQuote() {
    if (!quoteId) return;
    setShowDeleteDialog(true);
  }

  function openPdf() {
    if (!lexwareId) return;
    // Open PDF in new tab
    window.open(`/api/lexware/quote-pdf?lexwareId=${lexwareId}`, "_blank");
  }

  async function confirmDelete() {
    if (!quoteId) return;
    
    setShowDeleteDialog(false);
    setDeleting(true);
    try {
      // Delete quote items first
      await supabase
        .from("wawi_quote_items")
        .delete()
        .eq("quote_id", quoteId);
      
      // Delete the quote
      const { error } = await supabase
        .from("wawi_quotes")
        .delete()
        .eq("id", quoteId);
      
      if (error) throw error;
      
      setToastMessage({ type: "success", text: "Angebot gelöscht" });
      router.push("/quotes");
    } catch (error: any) {
      console.error("Delete error:", error);
      setToastMessage({ type: "error", text: error.message });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="space-y-6 pb-32 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#111] border border-[#1a1a1a] text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">
              {quoteId ? "Angebot bearbeiten" : "Neues Angebot"}
            </h1>
            {lexwareNumber && (
              <button
                onClick={openPdf}
                className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono rounded hover:bg-blue-500/30 transition-colors flex items-center gap-1.5"
                title="PDF in Lexware öffnen"
              >
                <FileText className="w-3 h-3" />
                {lexwareNumber}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
          {loadedTemplateName && (
            <p className="text-sm text-neutral-500">Vorlage: {loadedTemplateName}</p>
          )}
          {lexwareId && (
            <p className="text-sm text-yellow-500 mt-1">
              ⚠️ Bereits zu Lexware exportiert – Änderungen nicht mehr möglich
            </p>
          )}
        </div>
      </div>

      {/* Top Row: Kunde, Projekt, Datum, Gültig bis, Steuerart */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="form-group">
          <label className="form-label">Kunde</label>
          <button
            onClick={() => setShowCustomers(true)}
            className="input text-left flex items-center justify-between"
          >
            <span className={selectedCustomer ? "text-white" : "text-neutral-500"}>
              {selectedCustomer 
                ? (selectedCustomer.company_name || `${selectedCustomer.first_name} ${selectedCustomer.last_name}`)
                : "Kunde auswählen"
              }
            </span>
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Projekt</label>
          <select
            className="input"
            value={projectId || ""}
            onChange={(e) => setProjectId(e.target.value || null)}
            disabled={!customerId}
          >
            <option value="">Kein Projekt</option>
            {projects
              .filter(p => p.customer_id === customerId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            }
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Angebotsdatum</label>
          <input
            type="date"
            className="input"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gültig bis</label>
          <input
            type="date"
            className="input"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Steuerart</label>
          <select
            className="input"
            value={taxType}
            onChange={(e) => handleTaxTypeChange(e.target.value)}
          >
            {TAX_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Titel Row */}
      <div className="flex gap-4 items-start">
        <div className="form-group flex-1">
          <label className="form-label">Titel</label>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={25}
          />
          <p className="text-xs text-neutral-600 mt-1">{title.length}/25 Zeichen</p>
        </div>
        <div className="shrink-0">
          <label className="form-label invisible">.</label>
          <button
            onClick={() => setIsPackageDeal(!isPackageDeal)}
            className={`h-[42px] px-6 rounded-xl font-medium transition-all whitespace-nowrap ${
              isPackageDeal 
                ? "bg-[#fa432a] text-white" 
                : "bg-[#111] border border-[#1a1a1a] text-neutral-400 hover:text-white hover:border-[#333]"
            }`}
          >
            Komplettpaket
          </button>
        </div>
      </div>

      {/* Positions Table - Extracted Component */}
      <QuoteItemsList
        items={items}
        isPackageDeal={isPackageDeal}
        packageTitle={packageTitle}
        packageDescription={packageDescription}
        packagePrice={packagePrice}
        profitPercentage={profitPercentage}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
        onReorderItems={setItems}
        onEditItem={(index) => setEditingItemIndex(index)}
        onEditPackage={() => setEditingPackage(true)}
        onAddProduct={() => setShowProducts(true)}
      />
      
      {/* Edit Item Modal */}
      <Modal open={editingItemIndex !== null} onClose={() => setEditingItemIndex(null)} title="Position bearbeiten">
        {editingItemIndex !== null && items[editingItemIndex] && (
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Bezeichnung</label>
              <input
                type="text"
                className="input"
                value={items[editingItemIndex].product_name}
                onChange={(e) => updateItem(editingItemIndex, "product_name", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Beschreibung</label>
              <textarea
                className="input"
                rows={20}
                value={items[editingItemIndex].product_description || ""}
                onChange={(e) => updateItem(editingItemIndex, "product_description", e.target.value)}
                placeholder="z.B. Max. PV-Leistung 20,00 kWp"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Menge</label>
                <input
                  type="number"
                  className="input"
                  value={items[editingItemIndex].quantity}
                  onChange={(e) => updateItem(editingItemIndex, "quantity", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Einheit</label>
                <input
                  type="text"
                  className="input"
                  value={items[editingItemIndex].unit}
                  onChange={(e) => updateItem(editingItemIndex, "unit", e.target.value)}
                  placeholder="Stück, kWp, Pauschal..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setEditingItemIndex(null)} className="btn btn-primary">
                Fertig
              </button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Edit Package Modal */}
      <Modal open={editingPackage} onClose={() => setEditingPackage(false)} title="Komplettpaket bearbeiten">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Positions-Titel (wird im Angebot angezeigt)</label>
            <input
              type="text"
              className="input"
              value={packageTitle}
              onChange={(e) => setPackageTitle(e.target.value)}
              placeholder="z.B. Photovoltaik-Komplettpaket 10,5 kWp"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea
              className="input"
              rows={2}
              value={packageDescription}
              onChange={(e) => setPackageDescription(e.target.value)}
              placeholder="Optionale Zusatzinfo zum Paket..."
            />
          </div>
          <div className="p-3 bg-[#0d0d0d] rounded-xl">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">Paketpreis (gerundet):</span>
              <span className="text-white font-bold">{formatCurrency(packagePrice)}</span>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => setEditingPackage(false)} className="btn btn-primary">
              Fertig
            </button>
          </div>
        </div>
      </Modal>

      {/* Summary - Extracted Component */}
      <QuoteSummary
        subtotal={subtotal}
        discountAmount={discountAmount}
        afterDiscount={afterDiscount}
        isPackageDeal={isPackageDeal}
        packageSurcharge={packageSurcharge}
        taxAmount={taxAmount}
        total={total}
        profit={profit}
        profitPercentage={profitPercentage}
        isRentable={isRentable}
        globalDiscount={globalDiscount}
        onGlobalDiscountChange={setGlobalDiscount}
      />

      {/* Texts */}
      <section className="space-y-4">
        <div className="form-group">
          <label className="form-label">Einleitung</label>
          <textarea
            className="input"
            rows={4}
            placeholder="Einleitungstext..."
            value={introText}
            onChange={(e) => setIntroText(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Schlussbemerkung</label>
          <textarea
            className="input"
            rows={16}
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
          />
        </div>
      </section>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#1a1a1a] p-4 md:relative md:bg-transparent md:border-0 md:p-0">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="btn btn-secondary"
            >
              <FileStack className="w-4 h-4" />
              Vorlage laden
            </button>
            <button onClick={() => setShowProducts(true)} className="btn btn-secondary">
              <Plus className="w-4 h-4" />
              Produkte hinzufügen
            </button>
          </div>
          <div className="flex gap-2">
            {lexwareId && (
              <>
                <button
                  onClick={openPdf}
                  className="btn btn-secondary border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <FileText className="w-4 h-4" />
                  PDF anzeigen
                </button>
                <button
                  onClick={deleteQuote}
                  disabled={deleting}
                  className="btn btn-secondary border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  {deleting ? <Spinner className="!w-4 !h-4" /> : <Trash2 className="w-4 h-4" />}
                  Löschen
                </button>
              </>
            )}
            <button onClick={() => router.push("/quotes")} className="btn btn-secondary">
              {lexwareId ? "Schließen" : "Abbrechen"}
            </button>
            {quoteId && !lexwareId && (
              <button
                onClick={exportToLexware}
                disabled={exporting}
                className="btn btn-secondary border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
              >
                {exporting ? <Spinner className="!w-4 !h-4" /> : <Send className="w-4 h-4" />}
                Zu Lexware
              </button>
            )}
            {!lexwareId && (
              <button
                onClick={saveQuote}
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? <Spinner className="!w-4 !h-4" /> : <Save className="w-4 h-4" />}
                Angebot speichern
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Modal - Extracted Component */}
      <ProductSelector
        open={showProducts}
        onClose={() => setShowProducts(false)}
        products={products}
        onAddProduct={addProduct}
        onAddCustomItem={addCustomItem}
      />

      {/* Customers Modal */}
      <Modal open={showCustomers} onClose={() => setShowCustomers(false)} title="Kunde auswählen">
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          <button
            onClick={() => { setCustomerId(null); setShowCustomers(false); }}
            className="w-full p-3 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl text-left text-neutral-400"
          >
            Kein Kunde
          </button>
          {customers.map((customer) => (
            <button
              key={customer.id}
              onClick={() => { setCustomerId(customer.id); setShowCustomers(false); }}
              className={`w-full p-3 border rounded-xl text-left transition-all ${
                customerId === customer.id 
                  ? "bg-orange-500/10 border-orange-500/50" 
                  : "bg-[#0d0d0d] border-[#1a1a1a] hover:border-[#333]"
              }`}
            >
              <h4 className="font-medium text-white">
                {customer.company_name || `${customer.first_name} ${customer.last_name}`}
              </h4>
            </button>
          ))}
        </div>
      </Modal>

      {/* Templates Modal */}
      <Modal open={showTemplates} onClose={() => setShowTemplates(false)} title="Vorlage laden">
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {templates.length === 0 ? (
            <p className="text-center text-neutral-500 py-8">Keine Vorlagen vorhanden</p>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => loadTemplate(template.id)}
                className="w-full p-4 bg-[#0d0d0d] border border-[#1a1a1a] rounded-xl text-left hover:border-[#333] transition-colors"
              >
                <h4 className="font-medium text-white">{template.name}</h4>
                {template.description && (
                  <p className="text-sm text-neutral-500 mt-1">{template.description}</p>
                )}
                <p className="text-xs text-neutral-600 mt-2">
                  {template.items?.length || 0} Positionen
                </p>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} title="Angebot löschen">
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 font-medium">
              ⚠️ Angebot {lexwareNumber} wirklich löschen?
            </p>
            <p className="text-sm text-neutral-400 mt-2">
              Das Angebot muss auch in Lexware manuell gelöscht/storniert werden!
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setShowDeleteDialog(false)} 
              className="btn btn-secondary"
            >
              Abbrechen
            </button>
            <button 
              onClick={confirmDelete}
              disabled={deleting}
              className="btn bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? <Spinner className="!w-4 !h-4" /> : <Trash2 className="w-4 h-4" />}
              Löschen
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
            toastMessage.type === "success" 
              ? "bg-green-500/20 border border-green-500/30 text-green-400"
              : "bg-red-500/20 border border-red-500/30 text-red-400"
          }`}>
            {toastMessage.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{toastMessage.text}</span>
            <button 
              onClick={() => setToastMessage(null)}
              className="ml-2 p-1 hover:bg-white/10 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
