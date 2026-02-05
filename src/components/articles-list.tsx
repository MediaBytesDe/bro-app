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

type Category = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export function ArticlesList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

    // Load product_categories for hierarchy display
    const { data: cats } = await supabase
      .from("product_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    // Load products (category is TEXT field, not FK)
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (cats) setCategories(cats);
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

  // Build recursive category tree with unlimited nesting
  const categoryTree = useMemo(() => {
    type CategoryNode = Category & {
      children: CategoryNode[];
      products: Product[];
      totalProducts: number;
    };

    // Recursive function to build tree and count products at all levels
    const buildTree = (parentId: string | null): CategoryNode[] => {
      return categories
        .filter(c => c.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(cat => {
          const children = buildTree(cat.id); // Recursively build children
          const directProducts = filtered.filter(p => p.category_id === cat.id);
          const totalProducts = children.reduce((acc, child) => acc + child.totalProducts, 0) + directProducts.length;

          return {
            ...cat,
            children,
            products: directProducts,
            totalProducts
          };
        });
    };

    // Build tree from root level (categories with no parent)
    return buildTree(null).filter(node => node.totalProducts > 0 || !search);
  }, [filtered, categories, search]);

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

      {/* Recursive Category Tree */}
      <div className="space-y-2">
        {categoryTree.map(node => (
          <CategoryNode
            key={node.id}
            node={node}
            level={0}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            onProductClick={(id) => router.push(`/articles/${id}`)}
          />
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

// Recursive Category Node Component for unlimited nesting
function CategoryNode({ node, level, expandedCategories, toggleCategory, onProductClick }: {
  node: Category & { children: any[]; products: Product[]; totalProducts: number };
  level: number;
  expandedCategories: Set<string>;
  toggleCategory: (id: string) => void;
  onProductClick: (id: string) => void;
}) {
  const isExpanded = expandedCategories.has(node.id);
  const hasChildren = node.children.length > 0;
  const hasProducts = node.products.length > 0;

  // Root level (level 0) gets card styling
  if (level === 0) {
    return (
      <div className="border border-neutral-800 rounded-xl overflow-hidden">
        <button
          onClick={() => toggleCategory(node.id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 transition-colors"
        >
          <div className="flex items-center gap-3">
            <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            <span className="font-medium text-white">{node.name}</span>
            <span className="text-xs text-neutral-500">({node.totalProducts})</span>
          </div>
        </button>

        {isExpanded && (
          <div className="divide-y divide-neutral-800/50">
            {/* Render children recursively */}
            {hasChildren && node.children.map(child => (
              <CategoryNode
                key={child.id}
                node={child}
                level={level + 1}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                onProductClick={onProductClick}
              />
            ))}

            {/* Direct products */}
            {hasProducts && node.products.map(product => (
              <ProductRow
                key={product.id}
                product={product}
                onClick={() => onProductClick(product.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Nested levels (level > 0) get subcategory styling with indentation
  const indent = level * 16; // 16px per level

  return (
    <div>
      {/* Subcategory Header */}
      {(hasChildren || hasProducts) && (
        <div style={{ paddingLeft: `${indent}px` }} className="px-4 py-2 bg-neutral-900/30">
          <button
            onClick={() => hasChildren ? toggleCategory(node.id) : null}
            className="flex items-center gap-2 text-left w-full"
          >
            {hasChildren && (
              <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            )}
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              {node.name}
            </span>
            <span className="text-xs text-neutral-600">({node.totalProducts})</span>
          </button>
        </div>
      )}

      {/* Children (if expanded) */}
      {isExpanded && hasChildren && node.children.map(child => (
        <CategoryNode
          key={child.id}
          node={child}
          level={level + 1}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          onProductClick={onProductClick}
        />
      ))}

      {/* Products at this level */}
      {hasProducts && node.products.map(product => (
        <ProductRow
          key={product.id}
          product={product}
          onClick={() => onProductClick(product.id)}
        />
      ))}
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
