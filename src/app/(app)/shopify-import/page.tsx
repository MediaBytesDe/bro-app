"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Package, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";

interface ImportResult {
  action: "created" | "updated";
  product: {
    id: string;
    name: string;
    sku: string;
    net_selling_price: number;
    image_url?: string;
  };
}

export default function ShopifyImportPage() {
  const [productUrl, setProductUrl] = useState("");
  const [discount, setDiscount] = useState(20); // Default 20% Gewerberabatt
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productUrl.trim()) {
      setError("Bitte geben Sie eine Produkt-URL ein");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/shopify/import-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: productUrl.trim(),
          discountPercentage: discount
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }

      setResult(data);
      setProductUrl(""); // Clear input on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Package className="w-6 h-6 text-orange-400" />
          Solarhandel24 Produkt Import
        </h1>
      </div>

      {/* Import Form */}
      <div className="card p-6">
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="label">Produkt-URL</label>
            <input
              type="url"
              placeholder="https://solarhandel24.de/products/..."
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              disabled={loading}
              className="input w-full"
            />
            <p className="text-xs text-neutral-600 mt-1">
              Beispiel: https://solarhandel24.de/products/aiko-solar-490w-black-frame-dual-glass-a490-mce54dw-3p-54
            </p>
          </div>

          <div>
            <label className="label">Gewerberabatt (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="20"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              disabled={loading}
              className="input w-full"
            />
            <p className="text-xs text-neutral-600 mt-1">
              Der Listenpreis von Solarhandel24 wird um diesen Prozentsatz reduziert
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>
                <Spinner className="w-4 h-4" />
                Importiere...
              </>
            ) : (
              "Importieren"
            )}
          </button>
        </form>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-900 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {result && (
          <div className="mt-4 p-4 bg-green-900/20 border border-green-900 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-300 mb-3">
                  Produkt erfolgreich {result.action === "created" ? "erstellt" : "aktualisiert"}!
                </p>
                <div className="flex items-start gap-4">
                  {result.product.image_url && (
                    <img
                      src={result.product.image_url}
                      alt={result.product.name}
                      className="w-20 h-20 object-cover rounded border border-green-800"
                    />
                  )}
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-white">{result.product.name}</p>
                    <p className="text-neutral-400 mt-1">SKU: {result.product.sku}</p>
                    <p className="text-neutral-400">
                      Verkaufspreis (netto): {result.product.net_selling_price.toFixed(2)} €
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions Card */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-orange-400" />
          Anleitung
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-neutral-400">
          <li>Öffnen Sie das gewünschte Produkt auf Solarhandel24.de</li>
          <li>Kopieren Sie die vollständige URL aus der Adresszeile</li>
          <li>Fügen Sie die URL oben ein und klicken Sie auf "Importieren"</li>
          <li>Das Produkt wird mit den folgenden Parametern importiert:
            <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
              <li>Preis → Listeneinkaufspreis</li>
              <li>25% Gemeinkosten (overhead_percentage)</li>
              <li>30% Gewinnmarge (profit_margin)</li>
              <li>19% MwSt (tax_rate)</li>
            </ul>
          </li>
          <li>Existiert die SKU bereits, wird das Produkt aktualisiert</li>
        </ol>
      </div>
    </div>
  );
}
