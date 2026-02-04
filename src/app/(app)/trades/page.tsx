"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { invalidateCache } from "@/lib/trades";
import { 
  Wrench, 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical,
  Check,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  slug: string;
  label: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

export default function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    label: "",
    color: "#fa432a",
  });

  const supabase = createClient();

  useEffect(() => {
    loadTrades();
  }, []);

  async function loadTrades() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .order("sort_order");
      setTrades(data || []);
    } catch (err) {
      console.error("Error loading trades:", err);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingTrade(null);
    setForm({ slug: "", label: "", color: "#fa432a" });
    setShowModal(true);
  }

  function openEdit(trade: Trade) {
    setEditingTrade(trade);
    setForm({
      slug: trade.slug,
      label: trade.label,
      color: trade.color || "#fa432a",
    });
    setShowModal(true);
  }

  function generateSlug(label: string) {
    return label
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" }[c] || c))
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  async function saveTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Bitte Name eingeben");
      return;
    }

    setSaving(true);
    const slug = form.slug || generateSlug(form.label);

    if (editingTrade) {
      const { error } = await supabase
        .from("trades")
        .update({
          slug,
          label: form.label.trim(),
          color: form.color,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingTrade.id);

      if (error) {
        toast.error(`Fehler: ${error.message}`);
      } else {
        toast.success("Gewerk aktualisiert");
        invalidateCache();
        setShowModal(false);
        loadTrades();
      }
    } else {
      const maxSort = Math.max(0, ...trades.map(t => t.sort_order));
      const { error } = await supabase
        .from("trades")
        .insert({
          slug,
          label: form.label.trim(),
          color: form.color,
          sort_order: maxSort + 1,
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("Slug existiert bereits");
        } else {
          toast.error(`Fehler: ${error.message}`);
        }
      } else {
        toast.success("Gewerk erstellt");
        invalidateCache();
        setShowModal(false);
        loadTrades();
      }
    }
    setSaving(false);
  }

  async function toggleActive(trade: Trade) {
    const { error } = await supabase
      .from("trades")
      .update({ is_active: !trade.is_active })
      .eq("id", trade.id);

    if (!error) {
      invalidateCache();
      setTrades(trades.map(t => 
        t.id === trade.id ? { ...t, is_active: !t.is_active } : t
      ));
    }
  }

  async function deleteTrade(trade: Trade) {
    if (!confirm(`"${trade.label}" wirklich löschen?`)) return;

    const { error } = await supabase
      .from("trades")
      .delete()
      .eq("id", trade.id);

    if (error) {
      toast.error(`Fehler: ${error.message}`);
    } else {
      toast.success("Gewerk gelöscht");
      invalidateCache();
      loadTrades();
    }
  }

  async function moveUp(trade: Trade, index: number) {
    if (index === 0) return;
    const prev = trades[index - 1];
    
    await Promise.all([
      supabase.from("trades").update({ sort_order: trade.sort_order }).eq("id", prev.id),
      supabase.from("trades").update({ sort_order: prev.sort_order }).eq("id", trade.id),
    ]);
    
    invalidateCache();
    loadTrades();
  }

  async function moveDown(trade: Trade, index: number) {
    if (index === trades.length - 1) return;
    const next = trades[index + 1];
    
    await Promise.all([
      supabase.from("trades").update({ sort_order: trade.sort_order }).eq("id", next.id),
      supabase.from("trades").update({ sort_order: next.sort_order }).eq("id", trade.id),
    ]);
    
    invalidateCache();
    loadTrades();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Wrench className="w-7 h-7 text-[#fa432a]" />
            Gewerke
          </h1>
          <p className="text-neutral-400 mt-1">
            Verwalte die verfügbaren Gewerke für Partner-Jobs
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#fa432a] hover:bg-[#e03d26] text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neues Gewerk
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
              <th className="w-10"></th>
              <th className="text-left py-3 px-4">Slug</th>
              <th className="text-left py-3 px-4">Anzeigename</th>
              <th className="text-left py-3 px-4 w-24">Farbe</th>
              <th className="text-left py-3 px-4 w-24">Status</th>
              <th className="w-32"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, index) => (
              <tr
                key={trade.id}
                className={cn(
                  "border-b border-neutral-800/50 last:border-0 hover:bg-[#111] transition-colors",
                  !trade.is_active && "opacity-50"
                )}
              >
                <td className="py-3 px-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveUp(trade, index)}
                      disabled={index === 0}
                      className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(trade, index)}
                      disabled={index === trades.length - 1}
                      className="text-neutral-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <code className="text-sm text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                    {trade.slug}
                  </code>
                </td>
                <td className="py-3 px-4">
                  <span className="text-white font-medium">{trade.label}</span>
                </td>
                <td className="py-3 px-4">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: trade.color || "#fa432a" }}
                  />
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleActive(trade)}
                    className={cn(
                      "flex items-center gap-1 text-xs px-2 py-1 rounded",
                      trade.is_active
                        ? "bg-green-500/20 text-green-400"
                        : "bg-neutral-500/20 text-neutral-400"
                    )}
                  >
                    {trade.is_active ? (
                      <>
                        <Eye className="w-3 h-3" /> Aktiv
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3" /> Inaktiv
                      </>
                    )}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(trade)}
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTrade(trade)}
                      className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {trades.length === 0 && (
          <div className="p-12 text-center">
            <Wrench className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
            <p className="text-neutral-400">Noch keine Gewerke vorhanden</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md mx-4">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="text-lg font-semibold text-white">
                {editingTrade ? "Gewerk bearbeiten" : "Neues Gewerk"}
              </h3>
            </div>
            <form onSubmit={saveTrade} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Anzeigename *
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => {
                    setForm({ 
                      ...form, 
                      label: e.target.value,
                      slug: editingTrade ? form.slug : generateSlug(e.target.value)
                    });
                  }}
                  className="w-full bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white"
                  placeholder="z.B. DC-Montage"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Slug (technischer Name)
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                  placeholder="dc_montage"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Nur Kleinbuchstaben, Zahlen und Unterstriche
                </p>
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1">
                  Farbe
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-12 h-10 rounded cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="flex-1 bg-[#111] border border-neutral-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-[#fa432a] hover:bg-[#e03d26] text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? <Spinner className="w-5 h-5 mx-auto" /> : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
