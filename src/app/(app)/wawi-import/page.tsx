"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Database, CheckCircle, AlertCircle } from "lucide-react";

interface ImportResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  errors: Array<{ sku: string; error: string }>;
}

export default function WawiImportPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/wawi/import-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import fehlgeschlagen");
      }

      setResult(data);
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
          <Database className="w-6 h-6 text-orange-400" />
          Altes WAWI System Import
        </h1>
      </div>

      {/* Import Card */}
      <div className="card p-6">
        <p className="text-sm text-neutral-400 mb-4">
          Dieser Import holt alle Produkte aus dem alten WAWI System
          (https://wawi.sofort.solar) und importiert sie in die neue Datenbank.
        </p>
        <button
          onClick={handleImport}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? (
            <>
              <Spinner className="w-4 h-4" />
              Importiere...
            </>
          ) : (
            "Produkte importieren"
          )}
        </button>

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
                  Import erfolgreich abgeschlossen!
                </p>
                <div className="text-sm text-neutral-300 space-y-1">
                  <p>Gesamt: {result.total} Produkte</p>
                  <p>Neu erstellt: {result.created}</p>
                  <p>Aktualisiert: {result.updated}</p>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-red-300">Fehler ({result.errors.length}):</p>
                      <ul className="list-disc list-inside mt-1">
                        {result.errors.map((err, idx) => (
                          <li key={idx} className="text-red-300">
                            SKU {err.sku}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-white mb-3">
          Informationen
        </h2>
        <div className="text-sm text-neutral-400 space-y-2">
          <p>
            <strong className="text-neutral-300">Quelle:</strong> https://wawi.sofort.solar/api/products
          </p>
          <p>
            <strong className="text-neutral-300">Verhalten:</strong> Existierende Produkte (gleiche SKU) werden
            aktualisiert, neue Produkte werden angelegt.
          </p>
          <p>
            <strong className="text-neutral-300">Zweck:</strong> Wiederherstellung der Produktdaten nach
            Datenverlust durch Migration 004.
          </p>
        </div>
      </div>
    </div>
  );
}
