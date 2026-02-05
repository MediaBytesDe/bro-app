'use client';

import { memo } from 'react';
import { FileText, Download, Eye } from 'lucide-react';
import type { Document } from '@/types/database';

interface DocumentsSectionProps {
  documents: Document[];
  onUpload?: () => void;
  canUpload: boolean;
}

export const DocumentsSection = memo(function DocumentsSection({
  documents,
  onUpload,
  canUpload,
}: DocumentsSectionProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Dokumente ({documents.length})</h2>
        {canUpload && onUpload && (
          <button
            onClick={onUpload}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            + Hochladen
          </button>
        )}
      </div>

      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between p-3 bg-neutral-700/50 rounded-lg hover:bg-neutral-700 transition"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-sm text-neutral-400">
                    {formatFileSize(doc.file_size || 0)} • {doc.mime_type || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {doc.storage_url ? (
                  <>
                    <a
                      href={doc.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-neutral-600 rounded transition"
                      title="Ansehen"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <a
                      href={doc.storage_url}
                      download={doc.file_name}
                      className="p-2 hover:bg-neutral-600 rounded transition"
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-neutral-500">Keine URL</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-500 text-center py-8">Keine Dokumente vorhanden</p>
      )}
    </div>
  );
});
