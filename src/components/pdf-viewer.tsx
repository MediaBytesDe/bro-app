"use client";

import { X, Download, ExternalLink } from "lucide-react";

interface PDFViewerProps {
  isOpen: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function PDFViewer({ isOpen, pdfUrl, title = "PDF Vorschau", onClose }: PDFViewerProps) {
  if (!isOpen || !pdfUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="text-white">
          <h3 className="font-medium">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download="angebot.pdf"
            onClick={(e) => e.stopPropagation()}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
            title="Herunterladen"
          >
            <Download className="w-5 h-5" />
          </a>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
        <iframe
          src={pdfUrl}
          className="w-full h-full rounded-lg bg-white"
          title={title}
        />
      </div>
    </div>
  );
}
