"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Package,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  Settings,
} from "lucide-react";
import { Product, formatCurrency } from "@/types/wawi";

export function ArticlesList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Load products (category is TEXT field, not FK)
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (prods) {
      setProducts(prods);
      // All collapsed by default
      setExpandedCategories(new Set());
    }

    setLoading(false);
  }

  // Filter products
  const filtered = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.manufacturer || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  // Group by TEXT category field (simple grouping since category is TEXT, not FK)
  const grouped = useMemo(() => {
    const categoryMap = new Map<string, Product[]>();

    filtered.forEach(product => {
      const cat = product.category || "Unkategorisiert";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(product);
    });

    return Array.from(categoryMap.entries())
      .map(([name, products]) => ({
        id: name, // Use category name as ID for expand/collapse
        name,
        directProducts: products,
        totalProducts: products.length,
        subcategories: [] // No subcategories with TEXT schema
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const toggleCategory = (id: string) => {
    const next = new Set(expandedCategories);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedCategories(next);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Artikel</h1>
          <p className="text-sm text-neutral-500">{products.length} Artikel</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/articles/categories")}
            className="px-3 py-2 rounded-xl bg-neutral-800 text-sm text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            Kategorien
          </button>
          <button
            onClick={() => router.push("/articles/new")}
            className="w-10 h-10 rounded-xl bg-[#fa432a] flex items-center justify-center text-white hover:bg-[#ff6b4a] transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Artikel suchen..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-700"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        )}
      </div>

      {/* Results count when searching */}
      {search && (
        <p className="text-xs text-neutral-500">{filtered.length} Treffer</p>
      )}

      {/* Grouped List */}
      <div className="space-y-2">
        {grouped.map(main => (
          <div key={main.id} className="border border-neutral-800 rounded-xl overflow-hidden">
            {/* Main Category Header */}
            <button
              onClick={() => toggleCategory(main.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${expandedCategories.has(main.id) ? '' : '-rotate-90'}`} />
                <span className="font-medium text-white">{main.name}</span>
                <span className="text-xs text-neutral-500">({main.totalProducts})</span>
              </div>
            </button>

            {/* Expanded Content */}
            {expandedCategories.has(main.id) && (
              <div className="divide-y divide-neutral-800/50">
                {/* Subcategories */}
                {main.subcategories.map(sub => (
                  <div key={sub.id}>
                    {/* Subcategory Header */}
                    {sub.products.length > 0 && (
                      <>
                        <div className="px-4 py-2 bg-neutral-900/30">
                          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                            {sub.name}
                          </span>
                        </div>
                        {/* Products */}
                        {sub.products.map(product => (
                          <ProductRow key={product.id} product={product} onClick={() => router.push(`/articles/${product.id}`)} />
                        ))}
                      </>
                    )}
                  </div>
                ))}
                
                {/* Direct products (no subcategory) */}
                {main.directProducts.map(product => (
                  <ProductRow key={product.id} product={product} onClick={() => router.push(`/articles/${product.id}`)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-4 text-neutral-600" />
          <p className="text-neutral-500">Keine Artikel vorhanden</p>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900/30 cursor-pointer transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate group-hover:text-[#fa432a] transition-colors">
          {product.name}
        </p>
        <p className="text-xs text-neutral-500 font-mono">{product.sku}</p>
      </div>
      <div className="flex items-center gap-4 ml-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-neutral-500">EK</p>
          <p className="text-sm text-neutral-400 font-mono">{formatCurrency(product.bare_purchase_price)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-neutral-500">VK</p>
          <p className="text-sm font-medium text-white font-mono">{formatCurrency(product.net_selling_price)}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-neutral-400" />
      </div>
    </div>
  );
}
