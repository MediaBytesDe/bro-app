"use client";

import { useEffect } from "react";
import { X, Download, ExternalLink } from "lucide-react";

interface PDFViewerProps {
  isOpen: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function PDFViewer({ isOpen, pdfUrl, title = "PDF Vorschau", onClose }: PDFViewerProps) {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !pdfUrl) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "angebot.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-neutral-900 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-gradient-to-b from-[#fa432a] to-[#ff6b4a] rounded-full" />
          <h2 className="text-lg font-semibold text-white">{title}</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Button */}
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            title="PDF herunterladen"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Herunterladen</span>
          </button>

          {/* Open in New Tab */}
          <button
            onClick={handleOpenNewTab}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Neuer Tab</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            title="Schließen (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 w-full h-full">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
          className="w-full h-full"
          title={title}
        />
      </div>

      {/* Footer Hint */}
      <div className="px-6 py-2 bg-neutral-900 border-t border-neutral-800">
        <p className="text-xs text-neutral-500 text-center">
          Tipp: Verwende die Toolbar im PDF für Zoom, Navigation und Suche • ESC zum Schließen
        </p>
      </div>
    </div>
  );
}
