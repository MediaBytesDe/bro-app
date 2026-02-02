"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  FolderOpen,
  Plus,
  ChevronRight,
  Building2,
  Users,
  FileText,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import type { Project, Customer } from "@/types/database";

// Partial customer type for dropdown selections
type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;

// Icons für die Marken
const brandIcons: Record<string, string> = {
  "sofort-solar": "☀️",
  "nord-watt": "⚡",
  "gutachter-freese": "🔍",
  "media-bytes": "💻",
};

export default function ProjectsPage() {
  const [brands, setBrands] = useState<Project[]>([]);
  const [workfolders, setWorkfolders] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewWorkfolder, setShowNewWorkfolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    customer_id: "",
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadBrands();
    loadCustomers();
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      loadWorkfolders(selectedBrand.id);
    }
  }, [selectedBrand]);

  async function loadBrands() {
    setLoading(true);
    const { data } = await supabase
      .from("projects")
      .select("*")
      .is("parent_id", null)
      .order("sort_order", { ascending: true });
    setBrands(data || []);
    setLoading(false);
  }

  async function loadWorkfolders(brandId: string) {
    const { data } = await supabase
      .from("projects")
      .select("*, customer:customers(*)")
      .eq("parent_id", brandId)
      .order("created_at", { ascending: false });
    setWorkfolders(data || []);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from("customers")
      .select("id, company_name, first_name, last_name")
      .eq("status", "active")
      .order("company_name");
    setCustomers(data || []);
  }

  async function createWorkfolder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrand || !form.name.trim()) return;

    setSaving(true);

    const slug = form.name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: form.name,
        slug: `${selectedBrand.slug}-${slug}-${Date.now()}`,
        description: form.description || null,
        parent_id: selectedBrand.id,
        customer_id: form.customer_id || null,
      })
      .select("slug")
      .single();

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowNewWorkfolder(false);
    setForm({ name: "", description: "", customer_id: "" });

    if (data) {
      router.push(`/projects/${data.slug}`);
    }
  }

  function getCustomerName(customer: CustomerOption | null) {
    if (!customer) return "Kein Kunde";
    if (customer.company_name) return customer.company_name;
    return `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unbenannt";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Ansicht: Arbeitsmappen einer Marke
  if (selectedBrand) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedBrand(null);
                setWorkfolders([]);
              }}
              className="btn btn-ghost btn-sm"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">{brandIcons[selectedBrand.slug] || "📁"}</span>
              {selectedBrand.name}
              <span className="text-neutral-500 font-normal text-base ml-2">
                ({workfolders.length} Projekte)
              </span>
            </h1>
          </div>
          <button
            onClick={() => setShowNewWorkfolder(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            Neues Projekt
          </button>
        </div>

        {/* Workfolders Grid */}
        {workfolders.length === 0 ? (
          <div className="card p-8 text-center text-neutral-500">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Noch keine Projekte in {selectedBrand.name}</p>
            <button
              onClick={() => setShowNewWorkfolder(true)}
              className="btn btn-primary btn-sm mt-4"
            >
              <Plus className="w-4 h-4" />
              Erstes Projekt anlegen
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {workfolders.map((wf) => (
              <div
                key={wf.id}
                onClick={() => router.push(`/projects/${wf.slug}`)}
                className="card p-4 hover:border-orange-500/50 cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white">{wf.name}</h3>
                  <ChevronRight className="w-4 h-4 text-neutral-500" />
                </div>
                
                {wf.description && (
                  <p className="text-sm text-neutral-400 mb-3 line-clamp-2">
                    {wf.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {getCustomerName((wf as any).customer)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(wf.created_at || "").toLocaleDateString("de-DE")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Neues Projekt */}
        <Modal
          open={showNewWorkfolder}
          onClose={() => setShowNewWorkfolder(false)}
          title={`Neues Projekt in ${selectedBrand.name}`}
        >
          <form onSubmit={createWorkfolder} className="space-y-4">
            <div>
              <label className="label">Projektname *</label>
              <input
                type="text"
                className="input"
                placeholder="z.B. PV-Anlage Müller"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Kunde</label>
              <select
                className="input"
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
              >
                <option value="">-- Kunde auswählen --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getCustomerName(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Beschreibung</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Kurze Projektbeschreibung..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewWorkfolder(false)}
                className="btn btn-ghost"
              >
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Spinner /> : "Projekt anlegen"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // Ansicht: Marken-Übersicht (Top-Level)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-orange-400" />
          Projekte
        </h1>
      </div>

      {/* Info */}
      <p className="text-neutral-400 text-sm">
        Wähle eine Marke um deren Projekte zu sehen oder neue anzulegen.
      </p>

      {/* Brands Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {brands.map((brand) => (
          <div
            key={brand.id}
            onClick={() => setSelectedBrand(brand)}
            className="card p-6 hover:border-orange-500/50 cursor-pointer transition-all group"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{brandIcons[brand.slug] || "📁"}</span>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                  {brand.name}
                </h2>
                {brand.description && (
                  <p className="text-sm text-neutral-400 mt-1">{brand.description}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-500 group-hover:text-orange-400 transition-colors" />
            </div>
          </div>
        ))}
      </div>

      {brands.length === 0 && (
        <div className="card p-8 text-center text-neutral-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Keine Marken/Portfolios vorhanden</p>
          <p className="text-sm mt-2">
            Erstelle zuerst Top-Level Projekte (Sofort.Solar, Gutachter Freese, etc.)
          </p>
        </div>
      )}
    </div>
  );
}
