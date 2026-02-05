'use client';

import { memo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import type { Product } from '@/types/wawi';
import { PRODUCT_CATEGORIES, formatCurrency } from '@/types/wawi';
import { Modal } from '@/components/ui/modal';

interface ProductSelectorProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onAddProduct: (product: Product) => void;
  onAddCustomItem: () => void;
}

export const ProductSelector = memo(function ProductSelector({
  open,
  onClose,
  products,
  onAddProduct,
  onAddCustomItem,
}: ProductSelectorProps) {
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !productSearch ||
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = !productCategory || p.category === productCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <Modal open={open} onClose={onClose} title="Produkt hinzufügen">
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
          value={productCategory || ''}
          onChange={(e) => setProductCategory(e.target.value || null)}
        >
          <option value="">Alle Kategorien</option>
          {PRODUCT_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>

        <div className="max-h-[50vh] overflow-y-auto space-y-2">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => {
                onAddProduct(product);
                onClose();
              }}
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

        <button onClick={onAddCustomItem} className="btn btn-ghost w-full">
          <Plus className="w-4 h-4" />
          Manuelle Position
        </button>
      </div>
    </Modal>
  );
});
