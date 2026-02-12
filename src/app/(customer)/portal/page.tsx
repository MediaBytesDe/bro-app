"use client";

import { usePortalProjects, usePortalOffers, usePortalAppointments } from "@/hooks/use-portal-data";
import { useCustomerContext } from "@/hooks/use-customer-context";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { FolderOpen, FileText, Calendar, Clock, ArrowRight, Eye, X } from "lucide-react";

export default function CustomerPortalPage() {
  const { customerName, isImpersonating } = useCustomerContext();
  const { projects, loading: projLoading } = usePortalProjects();
  const { offers, loading: offLoading } = usePortalOffers();
  const { appointments, loading: aptLoading } = usePortalAppointments();

  const loading = projLoading || offLoading || aptLoading;
  const impersonateQuery = isImpersonating ? `?impersonate=true` : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const pendingOffers = offers.filter(o => o.status === "pending");
  const acceptedOffers = offers.filter(o => o.status === "accepted");
  const upcomingAppointments = appointments.filter(a => new Date(a.date) > new Date());

  return (
    <div className="space-y-8">
      {isImpersonating && (
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400">
            <Eye className="w-5 h-5" />
            <span className="font-medium">Admin-Ansicht</span>
            <span className="text-blue-400/70">– Du siehst das Portal als: <strong>{customerName}</strong></span>
          </div>
          <button onClick={() => window.close()} className="p-1 text-blue-400 hover:text-blue-300" title="Fenster schließen">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">
          Willkommen{customerName ? `, ${customerName.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-neutral-400 mt-1">
          Hier finden Sie einen Überblick über Ihre Projekte und Angebote.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FolderOpen} label="Projekte" value={projects.length} color="orange" />
        <StatCard icon={FileText} label="Angebote" value={offers.length} color="blue" />
        <StatCard icon={Clock} label="Offen" value={pendingOffers.length} color="yellow" />
        <StatCard icon={Calendar} label="Termine" value={upcomingAppointments.length} color="green" />
      </div>

      {/* Recent Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-orange-400" />
            Aktuelle Projekte
          </h2>
          {projects.length > 0 && (
            <Link href={`/portal/projekte${impersonateQuery}`} className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="card p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
            <p className="text-neutral-400">Noch keine Projekte vorhanden</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                href={`/portal/projekte/${project.id}${impersonateQuery}`}
                className="card p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <h3 className="font-medium text-white">{project.name}</h3>
                    <p className="text-xs text-neutral-500">
                      {project.sizeKwp ? `${project.sizeKwp} kWp · ` : ""}
                      {new Date(project.createdAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>
                <ProjectStatusBadge status={project.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Pending Offers */}
      {pendingOffers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-yellow-400" />
              Offene Angebote
            </h2>
            <Link href={`/portal/angebote${impersonateQuery}`} className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid gap-3">
            {pendingOffers.slice(0, 3).map((offer) => (
              <div key={offer.id} className="card p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">Offen</span>
                  <h3 className="font-medium text-white mt-1">{offer.title}</h3>
                </div>
                <p className="font-bold text-white">
                  {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(offer.totalPrice)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-400" />
              Nächste Termine
            </h2>
          </div>
          <div className="grid gap-3">
            {upcomingAppointments.slice(0, 3).map((apt) => (
              <div key={apt.id} className="card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-green-500/20 text-green-400 flex flex-col items-center justify-center text-xs font-semibold">
                  <span>{new Date(apt.date).toLocaleDateString("de-DE", { day: "2-digit" })}</span>
                  <span className="text-[10px]">{new Date(apt.date).toLocaleDateString("de-DE", { month: "short" })}</span>
                </div>
                <div>
                  <h3 className="font-medium text-white">{apt.title}</h3>
                  <p className="text-xs text-neutral-500">
                    {new Date(apt.date).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
                    {apt.location ? ` · 📍 ${apt.location}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    orange: "from-orange-500/20 to-red-500/20 text-orange-400",
    blue: "from-blue-500/20 to-cyan-500/20 text-blue-400",
    yellow: "from-yellow-500/20 to-orange-500/20 text-yellow-400",
    green: "from-green-500/20 to-emerald-500/20 text-green-400",
  };

  return (
    <div className={`card p-4 bg-gradient-to-br ${colors[color]}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function ProjectStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    angebot: { label: "Angebot", class: "bg-blue-500/20 text-blue-400" },
    auftrag: { label: "Auftrag", class: "bg-yellow-500/20 text-yellow-400" },
    material: { label: "Material", class: "bg-orange-500/20 text-orange-400" },
    montage: { label: "Montage", class: "bg-purple-500/20 text-purple-400" },
    abnahme: { label: "Abnahme", class: "bg-cyan-500/20 text-cyan-400" },
    fertig: { label: "Fertig", class: "bg-green-500/20 text-green-400" },
  };

  const info = statusMap[status] || { label: status, class: "bg-neutral-500/20 text-neutral-400" };
  return <span className={`text-xs px-2 py-1 rounded ${info.class}`}>{info.label}</span>;
}
