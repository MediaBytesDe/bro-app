"use client";

import { usePortalOffers } from "@/hooks/use-portal-data";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Check, X, Download } from "lucide-react";
import { useState } from "react";

export default function PortalAngebotePage() {
  const { offers, loading, respond } = usePortalOffers();
  const [responding, setResponding] = useState<number | null>(null);

  async function handleRespond(id: number, status: 'accepted' | 'rejected') {
    setResponding(id);
    try {
      await respond(id, status);
    } catch (err) {
      console.error(err);
    }
    setResponding(null);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  const pending = offers.filter(o => o.status === "pending");
  const decided = offers.filter(o => o.status !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-400" />
          Angebote
        </h1>
        <p className="text-neutral-400 mt-1">Ihre Angebote von BROjekt</p>
      </div>

      {offers.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Angebote vorhanden</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-yellow-400 mb-4">⏳ Offene Angebote</h2>
              <div className="space-y-4">
                {pending.map(offer => (
                  <div key={offer.id} className="card p-5 border-l-4 border-yellow-500">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{offer.title}</h3>
                        {offer.description && <p className="text-sm text-neutral-400 mt-1">{offer.description}</p>}
                        {offer.validUntil && (
                          <p className="text-xs text-neutral-500 mt-2">
                            Gültig bis: {new Date(offer.validUntil).toLocaleDateString("de-DE")}
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-white">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(offer.totalPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRespond(offer.id, "accepted")}
                        disabled={responding === offer.id}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Annehmen
                      </button>
                      <button
                        onClick={() => handleRespond(offer.id, "rejected")}
                        disabled={responding === offer.id}
                        className="flex items-center gap-2 px-5 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Ablehnen
                      </button>
                      {offer.pdfUrl && (
                        <a
                          href={offer.pdfUrl}
                          target="_blank"
                          className="flex items-center gap-2 px-4 py-2.5 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Download className="w-4 h-4" /> PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {decided.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-neutral-400 mb-4">Vergangene Angebote</h2>
              <div className="space-y-3">
                {decided.map(offer => (
                  <div key={offer.id} className="card p-4 flex items-center justify-between opacity-80">
                    <div>
                      <div className="flex items-center gap-2">
                        <OfferStatusBadge status={offer.status} />
                        <h3 className="font-medium text-white">{offer.title}</h3>
                      </div>
                      {offer.respondedAt && (
                        <p className="text-xs text-neutral-500 mt-1">
                          {offer.status === "accepted" ? "Angenommen" : "Abgelehnt"} am {new Date(offer.respondedAt).toLocaleDateString("de-DE")}
                        </p>
                      )}
                    </div>
                    <p className="font-bold text-white">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(offer.totalPrice)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OfferStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    accepted: { label: "✅ Angenommen", cls: "bg-green-500/20 text-green-400" },
    rejected: { label: "❌ Abgelehnt", cls: "bg-red-500/20 text-red-400" },
    expired: { label: "⏰ Abgelaufen", cls: "bg-neutral-500/20 text-neutral-400" },
  };
  const info = map[status] || { label: status, cls: "bg-neutral-500/20 text-neutral-400" };
  return <span className={`text-xs px-2 py-1 rounded ${info.cls}`}>{info.label}</span>;
}
