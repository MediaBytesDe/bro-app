'use client';

import { memo } from 'react';
import { Calendar, Clock, Building2, MapPin, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppointmentsToday, useAppointmentsUpcoming } from '@/lib/queries/appointments';

interface AppointmentsSectionProps {
  userId: string;
}

export const AppointmentsSection = memo(function AppointmentsSection({
  userId,
}: AppointmentsSectionProps) {
  const router = useRouter();
  const { data: todayAppointments, isLoading: loadingToday } = useAppointmentsToday();
  const { data: upcomingAppointments, isLoading: loadingUpcoming } = useAppointmentsUpcoming(7);

  if (loadingToday || loadingUpcoming) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-neutral-700 rounded w-1/3"></div>
            <div className="h-20 bg-neutral-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today's Appointments */}
      <section className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">
              <Calendar className="w-4 h-4" />
            </span>
            <h2 className="font-semibold text-white">Heute</h2>
            {todayAppointments && todayAppointments.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#fa432a]/10 text-[#fa432a] rounded">
                {todayAppointments.length}
              </span>
            )}
          </div>
          <button
            onClick={() => router.push('/calendar')}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-[#fa432a] transition-colors"
          >
            Kalender
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {todayAppointments && todayAppointments.length > 0 ? (
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center text-neutral-600 py-6">
            <p className="text-sm">Keine Termine heute</p>
          </div>
        )}
      </section>

      {/* Upcoming Appointments */}
      {upcomingAppointments && upcomingAppointments.length > 0 && (
        <section className="p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">
                <Clock className="w-4 h-4" />
              </span>
              <h2 className="font-semibold text-white">Kommende Termine</h2>
            </div>
          </div>

          <div className="space-y-2">
            {upcomingAppointments.map((apt) => (
              <AppointmentCardCompact key={apt.id} appointment={apt} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
});

// Appointment Card
function AppointmentCard({ appointment }: {
  appointment: any
}) {
  const time = new Date(appointment.start_time).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const customerName = appointment.customer
    ? (appointment.customer.company_name || `${appointment.customer.first_name} ${appointment.customer.last_name}`)
    : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-[#0d0d0d] rounded-xl">
      <div className="text-center min-w-[44px] px-2 py-1 bg-blue-500/10 rounded-lg">
        <div className="text-sm font-bold text-blue-400">{time}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white text-sm truncate">{appointment.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
          {customerName && (
            <span className="flex items-center gap-1 truncate">
              <Building2 className="w-3 h-3" />
              {customerName}
            </span>
          )}
          {appointment.location_address && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3" />
              {appointment.location_address.split(",")[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Appointment Card Compact
function AppointmentCardCompact({ appointment }: {
  appointment: any
}) {
  const date = new Date(appointment.start_time);
  const dayName = date.toLocaleDateString("de-DE", { weekday: "short" });
  const dayNum = date.getDate();
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#0d0d0d] transition-colors">
      <div className="text-center min-w-[36px]">
        <div className="text-[10px] text-neutral-500 uppercase">{dayName}</div>
        <div className="text-sm font-bold text-white">{dayNum}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{appointment.title}</div>
      </div>
      <div className="text-xs text-neutral-500">{time}</div>
    </div>
  );
}
