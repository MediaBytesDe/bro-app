'use client';

import { memo, useState } from 'react';
import { Trash2, GripVertical, Pencil, Plus, Package } from 'lucide-react';
import type { WawiQuoteItem } from '@/types/wawi';
import { formatCurrency, formatNumber } from '@/types/wawi';

interface QuoteItemsListProps {
  items: WawiQuoteItem[];
  isPackageDeal: boolean;
  packageTitle: string;
  packageDescription: string;
  packagePrice: number;
  profitPercentage: number;
  onUpdateItem: (index: number, field: keyof WawiQuoteItem, value: any) => void;
  onRemoveItem: (index: number) => void;
  onReorderItems: (newItems: WawiQuoteItem[]) => void;
  onEditItem: (index: number) => void;
  onEditPackage: () => void;
  onAddProduct: () => void;
}

export const QuoteItemsList = memo(function QuoteItemsList({
  items,
  isPackageDeal,
  packageTitle,
  packageDescription,
  packagePrice,
  profitPercentage,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onEditItem,
  onEditPackage,
  onAddProduct,
}: QuoteItemsListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleDrop = (targetIndex: number) => {
    if (dragIndex !== null && dragIndex !== targetIndex) {
      const newItems = [...items];
      const [draggedItem] = newItems.splice(dragIndex, 1);
      newItems.splice(targetIndex, 0, draggedItem);
      // Update position numbers with immutable pattern
      const updatedItems = newItems.map((item, i) => ({
        ...item,
        position_number: i + 1,
      }));
      onReorderItems(updatedItems);
    }
    setDragIndex(null);
  };

  if (items.length === 0 && !isPackageDeal) {
    return (
      <section className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <div className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-neutral-600" />
          <p className="text-neutral-500 mb-4">Keine Positionen hinzugefügt</p>
          <button onClick={onAddProduct} className="btn btn-primary">
            Produkte hinzufügen
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[24px_32px_1fr_80px_100px_80px_100px_80px_32px] gap-1 px-3 py-2 bg-[#0d0d0d] border-b border-[#1a1a1a] text-[10px] font-semibold text-neutral-500 uppercase">
        <div></div>
        <div>Pos.</div>
        <div>Produkt</div>
        <div className="text-center">Menge</div>
        <div className="text-right">Einzelpreis</div>
        <div className="text-center">Rabatt</div>
        <div className="text-right">Gesamt</div>
        <div className="text-right">Marge</div>
        <div></div>
      </div>

      <div className="divide-y divide-[#1a1a1a]">
        {/* Komplettpaket Position */}
        {isPackageDeal && (
          <div
            className="grid grid-cols-[24px_32px_1fr_80px_100px_80px_100px_80px_32px] gap-1 px-3 py-2 items-center bg-[#fa432a]/10 cursor-pointer hover:bg-[#fa432a]/15"
            onClick={onEditPackage}
          >
            <div></div>
            <div className="text-[#fa432a] font-mono text-xs font-bold">1</div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">
                {packageTitle || 'Photovoltaik-Komplettpaket'}
              </div>
              <div className="text-[10px] text-[#fa432a] truncate">
                Komplettpaket{packageDescription ? ` · ${packageDescription}` : ''}
              </div>
            </div>
            <div className="text-center text-xs text-neutral-400">1 Paket</div>
            <div className="text-right text-xs text-white">{formatCurrency(packagePrice)}</div>
            <div className="text-center text-neutral-600 text-xs">—</div>
            <div className="text-right text-sm font-bold text-white">
              {formatCurrency(packagePrice)}
            </div>
            <div className="text-right text-xs text-green-400">
              {formatNumber(profitPercentage, 1)}%
            </div>
            <div className="flex justify-center">
              <Pencil className="w-3 h-3 text-neutral-500" />
            </div>
          </div>
        )}

        {/* Regular Items with Drag & Drop */}
        {items.map((item, index) => (
          <div
            key={item._id || index}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => setDragIndex(null)}
            className={`grid grid-cols-[24px_32px_1fr_80px_100px_80px_100px_80px_32px] gap-1 px-3 py-2 items-center hover:bg-[#0d0d0d] transition-colors ${
              dragIndex === index ? 'opacity-50 bg-[#1a1a1a]' : ''
            }`}
          >
            {/* Drag Handle */}
            <div className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Position */}
            <div className="text-neutral-500 font-mono text-xs">
              {isPackageDeal ? index + 2 : index + 1}
            </div>

            {/* Product Name - clickable for edit */}
            <div
              className="min-w-0 cursor-pointer hover:bg-[#1a1a1a] rounded px-1 py-0.5 -mx-1"
              onClick={() => onEditItem(index)}
            >
              <div className="text-white text-sm truncate">{item.product_name}</div>
              {(item.product_description || item.sku) && (
                <div className="text-[10px] text-neutral-500 truncate">
                  {item.product_description || item.sku}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-center gap-0.5">
              <input
                type="number"
                className="w-12 bg-transparent border border-transparent hover:border-[#333] focus:border-[#fa432a] rounded text-center text-xs text-white py-1 focus:outline-none"
                value={item.quantity}
                onChange={(e) => onUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
              <span className="text-[10px] text-neutral-600">{item.unit}</span>
            </div>

            {/* Unit Price */}
            <div>
              <input
                type="number"
                className="w-full bg-transparent border border-transparent hover:border-[#333] focus:border-[#fa432a] rounded text-right text-xs text-white py-1 px-1 focus:outline-none"
                value={item.unit_price}
                onChange={(e) => onUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>

            {/* Discount */}
            <div>
              <input
                type="number"
                className="w-full bg-transparent border border-transparent hover:border-[#333] focus:border-[#fa432a] rounded text-center text-xs text-neutral-400 py-1 focus:outline-none"
                value={item.discount_percentage}
                onChange={(e) =>
                  onUpdateItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)
                }
                min="0"
                max="100"
                step="0.5"
              />
            </div>

            {/* Total */}
            <div className="text-right text-sm font-semibold text-white">
              {formatCurrency(item.total_price)}
            </div>

            {/* Margin */}
            <div
              className={`text-right text-xs ${
                item.margin_percentage >= 15 ? 'text-green-400' : 'text-orange-400'
              }`}
            >
              {formatNumber(item.margin_percentage, 1)}%
              <div className="text-[9px] text-neutral-600">
                {formatCurrency(item.margin_amount)}
              </div>
            </div>

            {/* Delete */}
            <div className="flex justify-center">
              <button
                onClick={() => onRemoveItem(index)}
                className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}

        {/* Add Position Button */}
        <button
          onClick={onAddProduct}
          className="w-full py-2 text-xs text-neutral-500 hover:text-white hover:bg-[#1a1a1a] transition-colors flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Position hinzufügen
        </button>
      </div>
    </section>
  );
});
