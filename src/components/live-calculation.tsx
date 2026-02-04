"use client";

import { TrendingUp } from "lucide-react";
import { formatCurrency } from "@/types/wawi";

interface CalcProps {
  purchaseListPrice: number;
  supplierDiscount: number;
  supplierSkonto: number;
  purchaseCosts: number;
  overheadPercentage: number;
  profitMargin: number;
  customerSkonto: number;
  customerDiscount: number;
  taxRate: number;
  compact?: boolean;
}

export function LiveCalculation({
  purchaseListPrice,
  supplierDiscount,
  supplierSkonto,
  purchaseCosts,
  overheadPercentage,
  profitMargin,
  customerSkonto,
  customerDiscount,
  taxRate,
  compact = true,
}: CalcProps) {
  // === BEZUGSKALKULATION ===
  const targetPurchasePrice = purchaseListPrice * (1 - supplierDiscount / 100);
  const barePurchasePrice = targetPurchasePrice * (1 - supplierSkonto / 100);
  const referencePrice = barePurchasePrice + purchaseCosts;

  // === SELBSTKOSTEN ===
  const handlingCosts = referencePrice * (overheadPercentage / 100);
  const costPrice = referencePrice + handlingCosts;

  // === VERKAUFSKALKULATION ===
  const profitAmount = costPrice * (profitMargin / 100);
  const bareSellingPrice = costPrice + profitAmount;
  const customerSkontoAmount = bareSellingPrice * (customerSkonto / 100);
  const targetSellingPrice = bareSellingPrice + customerSkontoAmount;
  const customerDiscountAmount = targetSellingPrice * (customerDiscount / 100);
  const netSellingPrice = targetSellingPrice + customerDiscountAmount;
  const taxAmount = netSellingPrice * (taxRate / 100);
  const grossSellingPrice = netSellingPrice + taxAmount;

  // === GEWINNMARGE ===
  // Gewinn = der Gewinnzuschlag-Betrag (nicht VK - EK)
  // Marge = der Gewinnzuschlag-Prozentsatz
  const totalProfit = profitAmount;
  const marginPercentage = profitMargin;

  const textSm = compact ? "text-[11px]" : "text-sm";
  const textXs = compact ? "text-[10px]" : "text-xs";
  const gap = compact ? "gap-0.5" : "gap-1.5";
  const mb = compact ? "mb-2" : "mb-4";

  return (
    <div className={`rounded-2xl bg-[#111] border border-[#1a1a1a] ${compact ? 'p-3' : 'p-5'}`}>
      <div className={`flex items-center gap-1.5 ${compact ? 'mb-2' : 'mb-5'}`}>
        <TrendingUp className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} text-[#fa432a]`} />
        <h2 className={`${compact ? 'text-[11px]' : 'text-sm'} font-semibold text-white`}>Live-Kalkulation</h2>
      </div>

      {/* Bezugskalkulation */}
      <div className={mb}>
        <span className={`${textXs} font-medium text-neutral-400`}>Bezugskalkulation:</span>
        <div className={`mt-1 space-y-px ${gap}`}>
          <Row label="Listeneinkaufspreis:" value={purchaseListPrice} compact={compact} />
          <Row label={`- Lieferrabatt (${supplierDiscount}%):`} value={-(purchaseListPrice - targetPurchasePrice)} color="red" compact={compact} />
          <Row label="= Zieleinkaufspreis:" value={targetPurchasePrice} compact={compact} />
          <Row label={`- Lieferskonto (${supplierSkonto}%):`} value={-(targetPurchasePrice - barePurchasePrice)} color="red" compact={compact} />
          <Row label="= Bareinkaufspreis:" value={barePurchasePrice} compact={compact} />
          <Row label="+ Bezugskosten:" value={purchaseCosts} color={purchaseCosts > 0 ? "blue" : undefined} compact={compact} />
          <Row label="= Bezugspreis:" value={referencePrice} bold compact={compact} />
        </div>
      </div>

      {/* Selbstkosten */}
      <div className={mb}>
        <span className={`${textXs} font-medium text-neutral-400`}>Selbstkosten:</span>
        <div className={`mt-1 space-y-px ${gap}`}>
          <Row label="Bezugspreis:" value={referencePrice} compact={compact} />
          <Row label={`+ Handlungskosten (${overheadPercentage}%):`} value={handlingCosts} color="blue" compact={compact} />
          <Row label="= Selbstkostenpreis:" value={costPrice} bold compact={compact} />
        </div>
      </div>

      {/* Verkaufskalkulation */}
      <div className={mb}>
        <span className={`${textXs} font-medium text-neutral-400`}>Verkaufskalkulation:</span>
        <div className={`mt-1 space-y-px ${gap}`}>
          <Row label="Selbstkostenpreis:" value={costPrice} compact={compact} />
          <Row label={`+ Gewinnzuschlag (${profitMargin}%):`} value={profitAmount} color="green" compact={compact} />
          <Row label="= Barverkaufspreis:" value={bareSellingPrice} compact={compact} />
          <Row label={`+ Kundenskonto (${customerSkonto}%):`} value={customerSkontoAmount} color={customerSkonto > 0 ? "blue" : undefined} compact={compact} />
          <Row label="= Zielverkaufspreis:" value={targetSellingPrice} compact={compact} />
          <Row label={`+ Kundenrabatt (${customerDiscount}%):`} value={customerDiscountAmount} color={customerDiscount > 0 ? "blue" : undefined} compact={compact} />
          <Row label="= Nettoverkaufspreis:" value={netSellingPrice} bold color="green" compact={compact} />
          <Row label={`+ MwSt. (${taxRate}%):`} value={taxAmount} color={taxRate > 0 ? "blue" : undefined} compact={compact} />
        </div>
      </div>

      {/* Bruttoverkaufspreis */}
      <div className={`${compact ? 'mt-2 pt-2' : 'mt-4 pt-4'} border-t border-neutral-800`}>
        <div className="flex justify-between items-center">
          <span className={`${compact ? 'text-[10px]' : 'text-sm'} font-semibold text-white`}>=</span>
          <span className={`${compact ? 'text-base' : 'text-xl'} font-bold text-white`}>{formatCurrency(grossSellingPrice)}</span>
        </div>
        <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-neutral-500`}>Bruttoverkaufspreis</div>
      </div>

      {/* Gewinnmarge */}
      <div className={`${compact ? 'mt-3 pt-2' : 'mt-5 pt-4'} border-t border-neutral-800`}>
        <span className={`${textXs} text-neutral-500 uppercase tracking-wider`}>Gewinnmarge:</span>
        <div className={`${compact ? 'mt-1' : 'mt-2'} flex justify-between`}>
          <div>
            <span className={`${textXs} text-green-400`}>Gewinn:</span>
            <div className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-green-400`}>{formatCurrency(totalProfit)}</div>
          </div>
          <div className="text-right">
            <span className={`${textXs} text-neutral-400`}>Marge:</span>
            <div className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-white`}>{marginPercentage.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ 
  label, 
  value, 
  bold, 
  color,
  compact = true,
}: { 
  label: string; 
  value: number; 
  bold?: boolean;
  color?: "red" | "green" | "blue";
  compact?: boolean;
}) {
  const colorClass = {
    red: "text-red-400",
    green: "text-green-400",
    blue: "text-blue-400",
  }[color || ""] || "text-neutral-300";

  const labelColor = {
    red: "text-red-400/70",
    green: "text-green-400/70",
  }[color || ""] || "text-neutral-500";

  const textSize = compact ? "text-[11px]" : "text-sm";

  return (
    <div className={`flex justify-between items-center ${textSize}`}>
      <span className={labelColor}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold text-white" : colorClass}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
