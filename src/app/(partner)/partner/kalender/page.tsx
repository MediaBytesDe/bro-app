"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  job_id: string;
  title: string;
  date: string;
  time_start: string | null;
  time_end: string | null;
  notes: string | null;
  status: string;
  job?: {
    id: string;
    title: string;
    status: string;
    project?: {
      name: string;
      customer?: {
        first_name: string;
        last_name: string;
        city: string;
        street: string;
        house_number: string;
        postal_code: string;
      };
    };
  };
}

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function PartnerKalenderPage() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(
    new Date().toISOString().split('T')[0]
  );

  const supabase = createClient();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) { setLoading(false); return; }
      setPartnerUser(pu);

    // Load appointments with job details
    const { data: appts } = await supabase
      .from("partner_job_appointments")
      .select(`
        *,
        job:partner_jobs (
          id, title, status,
          project:projects (
            name,
            customer:customers (first_name, last_name, city, street, house_number, postal_code)
          )
        )
      `)
      .eq("partner_id", pu.partner_id)
        .order("date", { ascending: true });

      setAppointments(appts || []);
    } catch (err) {
      console.error("Error loading calendar:", err);
    } finally {
      setLoading(false);
    }
  }

  const formatDateKey = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Group appointments by date
  const appointmentsByDate = appointments.reduce((acc, appt) => {
    if (!acc[appt.date]) {
      acc[appt.date] = [];
    }
    acc[appt.date].push(appt);
    return acc;
  }, {} as Record<string, Appointment[]>);

  const selectedAppointments = selectedDate ? appointmentsByDate[selectedDate] || [] : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Kalender</h1>
        <p className="text-neutral-400 mt-1">
          Übersicht deiner geplanten Termine
        </p>
      </div>

      {/* Kommende Termine */}
      <div className="card p-5 mb-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#fa432a]" />
          Kommende Termine
        </h2>
        {(() => {
          const upcoming = appointments
            .filter(a => a.date >= today)
            .slice(0, 5);
          
          if (upcoming.length === 0) {
            return (
              <p className="text-neutral-500 text-sm">Keine kommenden Termine</p>
            );
          }
          
          return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {upcoming.map((appt) => (
                <Link
                  key={appt.id}
                  href={`/partner/auftraege/${appt.job_id}`}
                  className="p-3 bg-[#111] rounded-lg hover:bg-[#1a1a1a] transition-colors"
                >
                  <p className="text-xs text-[#fa432a] font-medium">
                    {new Date(appt.date).toLocaleDateString('de-DE', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                    {appt.time_start && ` · ${appt.time_start.slice(0, 5)}`}
                  </p>
                  <p className="text-white font-medium text-sm mt-1 truncate">
                    {appt.title}
                  </p>
                  <p className="text-neutral-500 text-xs truncate">
                    {appt.job?.project?.name}
                  </p>
                  {appt.job?.project?.customer?.city && (
                    <p className="text-neutral-600 text-xs truncate flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {appt.job.project.customer.city}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Calendar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={prevMonth}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-neutral-400" />
            </button>
            <h2 className="text-lg font-semibold text-white">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-neutral-500 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-20" />;
              }

              const dateKey = formatDateKey(day);
              const dayAppointments = appointmentsByDate[dateKey] || [];
              const isSelected = selectedDate === dateKey;
              const isToday = dateKey === today;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateKey)}
                  className={cn(
                    "h-20 p-1 rounded-lg border text-left transition-colors",
                    "hover:bg-[#1a1a1a] border-neutral-800",
                    isSelected && "ring-2 ring-[#fa432a] bg-[#1a1a1a]",
                    isToday && !isSelected && "border-[#fa432a]"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isToday ? "text-[#fa432a]" : "text-neutral-300"
                    )}
                  >
                    {day}
                  </span>
                  {dayAppointments.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayAppointments.slice(0, 2).map((appt) => (
                        <div
                          key={appt.id}
                          className="text-xs truncate px-1 rounded bg-[#fa432a]/20 text-[#fa432a]"
                        >
                          {appt.time_start?.slice(0, 5)} {appt.title}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-neutral-500 px-1">
                          +{dayAppointments.length - 2} weitere
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {selectedDate
              ? new Date(selectedDate + "T00:00:00").toLocaleDateString("de-DE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Tag auswählen"}
          </h2>

          {selectedAppointments.length === 0 ? (
            <div className="card p-8 text-center text-neutral-500">
              Keine Termine an diesem Tag
            </div>
          ) : (
            selectedAppointments.map((appt) => (
              <div key={appt.id} className="card p-4 hover:bg-[#1a1a1a] transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{appt.title}</h3>
                    <p className="text-sm text-neutral-500">
                      {appt.job?.title} · {appt.job?.project?.name}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-[#fa432a]/20 text-[#fa432a]">
                    {appt.status === 'completed' ? 'Erledigt' : 'Geplant'}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <Clock className="h-4 w-4" />
                    <span>
                      {appt.time_start?.slice(0, 5) || '–'}
                      {appt.time_end && ` - ${appt.time_end.slice(0, 5)}`} Uhr
                    </span>
                  </div>
                  {appt.job?.project?.customer && (
                    <div className="flex items-center gap-2 text-neutral-400">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {appt.job.project.customer.street} {appt.job.project.customer.house_number}, {' '}
                        {appt.job.project.customer.postal_code} {appt.job.project.customer.city}
                      </span>
                    </div>
                  )}
                  {appt.notes && (
                    <p className="text-neutral-500 text-xs mt-2">{appt.notes}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-3 mt-3 border-t border-neutral-800">
                  <Link
                    href={`/partner/auftraege/${appt.job_id}`}
                    className="btn-secondary flex-1 text-center text-sm"
                  >
                    Zum Auftrag
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
