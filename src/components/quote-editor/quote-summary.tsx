'use client';

import { memo } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/types/wawi';

interface QuoteSummaryProps {
  subtotal: number;
  discountAmount: number;
  afterDiscount: number;
  isPackageDeal: boolean;
  packageSurcharge: number;
  taxAmount: number;
  total: number;
  profit: number;
  profitPercentage: number;
  isRentable: boolean;
  globalDiscount: number;
  onGlobalDiscountChange: (discount: number) => void;
}

export const QuoteSummary = memo(function QuoteSummary({
  subtotal,
  discountAmount,
  afterDiscount,
  isPackageDeal,
  packageSurcharge,
  taxAmount,
  total,
  profit,
  profitPercentage,
  isRentable,
  globalDiscount,
  onGlobalDiscountChange,
}: QuoteSummaryProps) {
  return (
    <section className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded bg-[#1a1a1a] flex items-center justify-center text-xs">
          Σ
        </span>
        Zusammenfassung
      </h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-neutral-400">
          <span>Zwischensumme:</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Rabatt:</span>
          <span>-{formatCurrency(discountAmount)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>Nach Rabatt:</span>
          <span>{formatCurrency(afterDiscount)}</span>
        </div>
        {isPackageDeal && packageSurcharge > 0 && (
          <div className="flex justify-between text-orange-400 font-medium">
            <span>Zuschlag (99-Endung):</span>
            <span>+{formatCurrency(packageSurcharge)}</span>
          </div>
        )}
        <div className="flex justify-between text-neutral-400">
          <span>Mehrwertsteuer:</span>
          <span>{formatCurrency(taxAmount)}</span>
        </div>

        <div className="border-t border-[#262626] pt-3 mt-3">
          <div className="flex justify-between text-lg font-bold">
            <span className="text-white">Gesamt:</span>
            <span className="text-white">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="border-t border-[#262626] pt-3 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-white font-semibold">Gewinn:</span>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${isRentable ? 'text-green-400' : 'text-red-400'}`}
              >
                {formatCurrency(profit)} ({formatNumber(profitPercentage, 1)}%)
              </span>
              <div className="flex items-center gap-1 justify-end mt-1">
                {isRentable ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">Rentabel</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400">Nicht rentabel</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Global Discount Input */}
        <div className="inline-flex items-center gap-2 pt-4 border-t border-[#262626] mt-4">
          <span className="text-neutral-400 text-sm">Globaler Rabatt:</span>
          <input
            type="number"
            className="w-16 bg-[#1a1a1a] border border-[#262626] rounded-lg text-center text-white py-1.5 px-2 focus:border-[#fa432a] focus:outline-none"
            value={globalDiscount}
            onChange={(e) => onGlobalDiscountChange(parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
            step="0.5"
          />
          <span className="text-neutral-400 text-sm">%</span>
        </div>
      </div>
    </section>
  );
});
