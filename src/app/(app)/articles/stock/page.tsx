import { StockOverview } from "@/components/stock-overview";

export default function StockPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">Lagerbestand</h1>
      <StockOverview />
    </div>
  );
}
