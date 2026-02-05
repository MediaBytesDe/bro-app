"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface PDFViewerProps {
  isOpen: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
}

export function PDFViewer({ isOpen, pdfUrl, onClose }: PDFViewerProps) {
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

  if (!isOpen || !pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        title="Schließen (ESC)"
      >
        <X className="w-5 h-5" />
      </button>

      {/* PDF iframe */}
      <iframe
        src={pdfUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
      />
    </div>
  );
}
