"use client";

import { usePortalAppointments } from "@/hooks/use-portal-data";
import { Spinner } from "@/components/ui/spinner";
import { Calendar, MapPin, Clock } from "lucide-react";

export default function PortalTerminePage() {
  const { appointments, loading } = usePortalAppointments();

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  }

  const now = new Date();
  const upcoming = appointments.filter(a => new Date(a.date) >= now);
  const past = appointments.filter(a => new Date(a.date) < now);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-green-400" />
          Termine
        </h1>
        <p className="text-neutral-400 mt-1">Ihre anstehenden und vergangenen Termine</p>
      </div>

      {appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Termine geplant</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-green-400 mb-4">Anstehende Termine</h2>
              <div className="space-y-3">
                {upcoming.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-neutral-400 mb-4">Vergangene Termine</h2>
              <div className="space-y-3">
                {past.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} isPast />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentCard({ appointment: apt, isPast = false }: { appointment: any; isPast?: boolean }) {
  const d = new Date(apt.date);
  const daysUntil = Math.ceil((d.getTime() - Date.now()) / 86400000);

  const typeColors: Record<string, string> = {
    begehung: "bg-blue-500/20 text-blue-400",
    montage: "bg-purple-500/20 text-purple-400",
    abnahme: "bg-green-500/20 text-green-400",
    termin: "bg-orange-500/20 text-orange-400",
  };

  const statusColors: Record<string, string> = {
    confirmed: "text-green-400",
    cancelled: "text-red-400",
    completed: "text-neutral-400",
  };

  return (
    <div className={`card p-4 flex items-start gap-4 ${isPast ? "opacity-60" : ""}`}>
      <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-400 flex flex-col items-center justify-center font-semibold shrink-0">
        <span className="text-lg">{d.toLocaleDateString("de-DE", { day: "2-digit" })}</span>
        <span className="text-[10px] uppercase">{d.toLocaleDateString("de-DE", { month: "short" })}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-white">{apt.title}</h3>
          <span className={`text-xs px-2 py-0.5 rounded ${typeColors[apt.type] || typeColors.termin}`}>
            {apt.type}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
          </span>
          {apt.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {apt.location}
            </span>
          )}
        </div>
        {apt.description && <p className="text-sm text-neutral-500 mt-2">{apt.description}</p>}
        {!isPast && daysUntil <= 7 && daysUntil > 0 && (
          <p className="text-xs text-green-400 mt-2">In {daysUntil} {daysUntil === 1 ? "Tag" : "Tagen"}</p>
        )}
        {!isPast && daysUntil === 0 && (
          <p className="text-xs text-red-400 font-medium mt-2">Heute!</p>
        )}
      </div>
      <span className={`text-xs ${statusColors[apt.status] || "text-neutral-400"}`}>
        {apt.status === "confirmed" ? "✅" : apt.status === "cancelled" ? "❌" : "✔"}
      </span>
    </div>
  );
}
