"use client";

import { usePortalProjects } from "@/hooks/use-portal-data";
import { Spinner } from "@/components/ui/spinner";
import { FolderOpen } from "lucide-react";
import Link from "next/link";

const statusSteps = ["angebot", "auftrag", "material", "montage", "abnahme", "fertig"];
const statusLabels: Record<string, string> = {
  angebot: "Angebot", auftrag: "Auftrag", material: "Material",
  montage: "Montage", abnahme: "Abnahme", fertig: "Fertig",
};

export default function PortalProjektePage() {
  const { projects, loading } = usePortalProjects();

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-orange-400" />
          Ihre Projekte
        </h1>
      </div>

      {projects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Projekte</p>
          <p className="text-neutral-500 text-sm mt-2">Kontaktieren Sie uns unter 04971 9472940</p>
        </div>
      ) : (
        <div className="space-y-6">
          {projects.map(project => {
            const stepIdx = statusSteps.indexOf(project.status);
            const progress = Math.round(((stepIdx + 1) / statusSteps.length) * 100);

            return (
              <div key={project.id} className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{project.name}</h2>
                    <p className="text-sm text-neutral-400">
                      {project.sizeKwp ? `${project.sizeKwp} kWp` : ""}
                      {project.address ? ` · ${project.address}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-orange-400">{progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-neutral-800 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Steps */}
                <div className="flex justify-between mb-4">
                  {statusSteps.map((step, i) => {
                    const isDone = i < stepIdx;
                    const isCurrent = i === stepIdx;
                    return (
                      <div key={step} className="flex flex-col items-center flex-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                          isDone ? "bg-orange-500 text-white" :
                          isCurrent ? "bg-orange-500/20 text-orange-400 ring-2 ring-orange-500" :
                          "bg-neutral-800 text-neutral-500"
                        }`}>
                          {isDone ? "✓" : i + 1}
                        </div>
                        <span className={`text-[10px] mt-1 ${isDone || isCurrent ? "text-white" : "text-neutral-600"}`}>
                          {statusLabels[step]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm text-neutral-400 border-t border-neutral-800 pt-4">
                  {project.totalPrice && (
                    <span>💰 {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(project.totalPrice)}</span>
                  )}
                  {project.documents && <span>📄 {project.documents.length} Dokumente</span>}
                  {project.offers && <span>📋 {project.offers.length} Angebote</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
