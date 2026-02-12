"use client";

import { usePortalDocuments } from "@/hooks/use-portal-data";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Download, File, Image, FileSpreadsheet } from "lucide-react";

const typeIcons: Record<string, string> = {
  angebot: "📄", auftrag: "📝", rechnung: "💰", planung: "📐",
  protokoll: "✅", zertifikat: "🏆", sonstiges: "📎",
};

function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function PortalDokumentePage() {
  const { documents, loading } = usePortalDocuments();

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  // Group by type
  const grouped = documents.reduce((acc, doc) => {
    const type = doc.type || "sonstiges";
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, typeof documents>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6 text-orange-400" />
          Dokumente
        </h1>
        <p className="text-neutral-400 mt-1">Ihre Projektdokumente</p>
      </div>

      {documents.length === 0 ? (
        <div className="card p-12 text-center">
          <File className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Dokumente vorhanden</p>
        </div>
      ) : (
        Object.entries(grouped).map(([type, docs]) => (
          <section key={type}>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>{typeIcons[type] || "📎"}</span>
              {type.charAt(0).toUpperCase() + type.slice(1)}
              <span className="text-sm text-neutral-500">({docs.length})</span>
            </h2>
            <div className="space-y-2">
              {docs.map(doc => (
                <a
                  key={doc.id}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener"
                  className="card p-4 flex items-center gap-4 hover:bg-[#1a1a1a] transition-colors group"
                >
                  <span className="text-2xl">{typeIcons[doc.type] || "📎"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate group-hover:text-orange-400">{doc.name}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(doc.createdAt).toLocaleDateString("de-DE")}
                      {doc.size ? ` · ${formatSize(doc.size)}` : ""}
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-neutral-500 group-hover:text-orange-400" />
                </a>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
