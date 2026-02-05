'use client';

import { memo } from 'react';
import { Calendar, MapPin, Euro, Clock } from 'lucide-react';

interface InfoSectionProps {
  project: {
    description?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    budget?: number;
    created_at: string;
    updated_at: string;
  };
}

export const InfoSection = memo(function InfoSection({ project }: InfoSectionProps) {
  return (
    <div className="bg-neutral-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Projektinformationen</h2>

      <div className="space-y-4">
        {/* Description */}
        {project.description && (
          <div>
            <p className="text-sm text-neutral-400 mb-1">Beschreibung</p>
            <p className="text-neutral-200">{project.description}</p>
          </div>
        )}

        {/* Date range */}
        {(project.start_date || project.end_date) && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Zeitraum</p>
              <p className="text-neutral-200">
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString('de-DE')
                  : 'Kein Start'}{' '}
                -{' '}
                {project.end_date
                  ? new Date(project.end_date).toLocaleDateString('de-DE')
                  : 'Kein Ende'}
              </p>
            </div>
          </div>
        )}

        {/* Location */}
        {project.location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Standort</p>
              <p className="text-neutral-200">{project.location}</p>
            </div>
          </div>
        )}

        {/* Budget */}
        {project.budget && (
          <div className="flex items-center gap-2">
            <Euro className="h-4 w-4 text-neutral-400" />
            <div>
              <p className="text-sm text-neutral-400">Budget</p>
              <p className="text-neutral-200">
                {new Intl.NumberFormat('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                }).format(project.budget)}
              </p>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <div>
            <p className="text-sm text-neutral-400">Erstellt</p>
            <p className="text-neutral-200 text-sm">
              {new Date(project.created_at).toLocaleString('de-DE')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-neutral-400" />
          <div>
            <p className="text-sm text-neutral-400">Zuletzt aktualisiert</p>
            <p className="text-neutral-200 text-sm">
              {new Date(project.updated_at).toLocaleString('de-DE')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});
