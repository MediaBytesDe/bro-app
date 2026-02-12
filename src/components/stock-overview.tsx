"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  Package, AlertTriangle, TrendingDown, TrendingUp,
  ArrowDownCircle, ArrowUpCircle, Search, Filter,
  BarChart3
} from "lucide-react";
import { Product, formatCurrency } from "@/types/wawi";

type StockMovement = {
  id: string;
  product_id: string;
  type: "in" | "out" | "adjustment" | "return";
  quantity: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  product?: { name: string; sku: string };
};

const movementTypeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  in: { label: "Eingang", icon: <ArrowDownCircle className="w-4 h-4" />, color: "text-green-400" },
  out: { label: "Ausgang", icon: <ArrowUpCircle className="w-4 h-4" />, color: "text-red-400" },
  adjustment: { label: "Korrektur", icon: <BarChart3 className="w-4 h-4" />, color: "text-yellow-400" },
  return: { label: "Rückgabe", icon: <ArrowDownCircle className="w-4 h-4" />, color: "text-blue-400" },
};

export function StockOverview() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [showMovement, setShowMovement] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movementForm, setMovementForm] = useState({
    type: "in" as "in" | "out" | "adjustment" | "return",
    quantity: "",
    reference: "",
    notes: "",
  });

  const supabase = createClient();

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("name");
    setProducts(data || []);
    setLoading(false);
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());

    if (filter === "low") return matchesSearch && p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0;
    if (filter === "out") return matchesSearch && p.stock_quantity <= 0;
    return matchesSearch;
  });

  const lowStockCount = products.filter((p) => p.stock_quantity <= p.min_stock_level && p.stock_quantity > 0).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;
  const totalStockValue = products.reduce((sum, p) => sum + p.stock_quantity * p.purchase_list_price, 0);

  function openMovement(product: Product) {
    setSelectedProduct(product);
    setMovementForm({ type: "in", quantity: "", reference: "", notes: "" });
    setShowMovement(true);
  }

  async function saveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;

    const qty = parseInt(movementForm.quantity);
    if (isNaN(qty) || qty <= 0) return;

    // Calculate new stock
    const delta = movementForm.type === "out" ? -qty : qty;
    const newStock = selectedProduct.stock_quantity + delta;

    // Update product stock
    await supabase
      .from("products")
      .update({ stock_quantity: newStock })
      .eq("id", selectedProduct.id);

    // Try to log the movement (table may not exist yet)
    try {
      await supabase.from("stock_movements").insert({
        product_id: selectedProduct.id,
        type: movementForm.type,
        quantity: qty,
        reference: movementForm.reference || null,
        notes: movementForm.notes || null,
      });
    } catch {
      // stock_movements table doesn't exist yet - that's ok
    }

    setShowMovement(false);
    await loadProducts();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Artikel</div>
          <div className="text-lg font-bold text-white">{products.length}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Lagerwert</div>
          <div className="text-lg font-bold text-green-400">{formatCurrency(totalStockValue)}</div>
        </div>
        <button
          onClick={() => setFilter(filter === "low" ? "all" : "low")}
          className={`card p-3 text-left transition-all ${filter === "low" ? "ring-1 ring-yellow-500/50" : ""}`}
        >
          <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-yellow-400" /> Niedrig
          </div>
          <div className="text-lg font-bold text-yellow-400">{lowStockCount}</div>
        </button>
        <button
          onClick={() => setFilter(filter === "out" ? "all" : "out")}
          className={`card p-3 text-left transition-all ${filter === "out" ? "ring-1 ring-red-500/50" : ""}`}
        >
          <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-red-400" /> Leer
          </div>
          <div className="text-lg font-bold text-red-400">{outOfStockCount}</div>
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="p-3 border-b border-[#1f1f1f]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Artikel suchen..."
              className="input pl-9"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="divide-y divide-[#1f1f1f]">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Keine Artikel gefunden
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isLow = product.stock_quantity <= product.min_stock_level;
              const isOut = product.stock_quantity <= 0;
              const stockPercent = product.min_stock_level > 0
                ? Math.min(100, (product.stock_quantity / (product.min_stock_level * 2)) * 100)
                : 100;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 hover:bg-[#161616] transition-colors"
                >
                  {/* Stock indicator */}
                  <div className={`w-2 h-8 rounded-full ${
                    isOut ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-green-500"
                  }`} />

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">{product.name}</span>
                      {product.sku && (
                        <span className="text-[10px] text-neutral-600 font-mono">{product.sku}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {/* Stock bar */}
                      <div className="w-20 h-1.5 bg-[#1f1f1f] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOut ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${stockPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500">
                        {product.stock_quantity} / {product.min_stock_level} {product.unit}
                      </span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-white">
                      {formatCurrency(product.net_selling_price || product.gross_selling_price)}
                    </div>
                    <div className="text-[10px] text-neutral-600">
                      EK: {formatCurrency(product.purchase_list_price)}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => openMovement(product)}
                    className="btn btn-ghost btn-icon !w-9 !h-9 shrink-0"
                    title="Bestandsbuchung"
                  >
                    <Package className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Movement Modal */}
      <Modal
        open={showMovement}
        onClose={() => setShowMovement(false)}
        title={`Bestandsbuchung: ${selectedProduct?.name || ""}`}
      >
        <form onSubmit={saveMovement} className="space-y-4">
          <div>
            <label className="form-label">Aktueller Bestand</label>
            <div className="text-lg font-bold text-white">
              {selectedProduct?.stock_quantity} {selectedProduct?.unit}
            </div>
          </div>

          <div>
            <label className="form-label">Buchungsart</label>
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out", "adjustment", "return"] as const).map((type) => {
                const config = movementTypeLabels[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMovementForm({ ...movementForm, type })}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                      movementForm.type === type
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-white"
                        : "border-[#262626] text-neutral-400 hover:border-[#333]"
                    }`}
                  >
                    <span className={config.color}>{config.icon}</span>
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="form-label">Menge</label>
            <input
              type="number"
              min="1"
              value={movementForm.quantity}
              onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
              required
              className="input"
              placeholder="0"
            />
          </div>

          <div>
            <label className="form-label">Referenz (optional)</label>
            <input
              value={movementForm.reference}
              onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
              className="input"
              placeholder="z.B. Lieferschein-Nr., Auftrag..."
            />
          </div>

          <div>
            <label className="form-label">Notiz (optional)</label>
            <textarea
              value={movementForm.notes}
              onChange={(e) => setMovementForm({ ...movementForm, notes: e.target.value })}
              rows={2}
              className="input"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn btn-primary flex-1">
              Buchen
            </button>
            <button type="button" onClick={() => setShowMovement(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
