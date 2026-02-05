'use client';

import { memo } from 'react';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

interface HeaderSectionProps {
  project: {
    id: string;
    name: string;
    status: string;
    customer?: {
      company_name?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
}

export const HeaderSection = memo(function HeaderSection({
  project,
  onBack,
  onEdit,
  onDelete,
  canEdit,
}: HeaderSectionProps) {
  const customerName =
    project.customer?.company_name ||
    `${project.customer?.first_name || ''} ${project.customer?.last_name || ''}`.trim() ||
    'Unbekannter Kunde';

  return (
    <div className="bg-neutral-800 border-b border-neutral-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Zurück</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-neutral-400">{customerName}</p>
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
              >
                <Edit className="h-4 w-4" />
                <span>Bearbeiten</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
              >
                <Trash2 className="h-4 w-4" />
                <span>Löschen</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="mt-4">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            project.status === 'active'
              ? 'bg-green-900/20 text-green-400'
              : project.status === 'completed'
              ? 'bg-blue-900/20 text-blue-400'
              : 'bg-neutral-700 text-neutral-400'
          }`}
        >
          {project.status}
        </span>
      </div>
    </div>
  );
});
