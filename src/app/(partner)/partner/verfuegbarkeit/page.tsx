"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Availability {
  id: string;
  date: string;
  status: "available" | "unavailable" | "limited";
  capacity_percent: number;
  notes: string | null;
}

const monthNames = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];
const dayNames = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }

export default function VerfuegbarkeitPage() {
  const [loading, setLoading] = useState(true);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [availability, setAvailability] = useState<Record<string, Availability>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<"available" | "unavailable" | "limited">("unavailable");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDates, setBulkDates] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editCapacity, setEditCapacity] = useState(50);

  const supabase = createClient();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (partnerUser) loadAvailability(); }, [year, month, partnerUser]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: pu } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();
    if (!pu) { setLoading(false); return; }
    setPartnerUser(pu);
    setLoading(false);
  }

  async function loadAvailability() {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${daysInMonth}`;
    
    const { data } = await supabase
      .from("partner_availability")
      .select("*")
      .eq("partner_id", partnerUser.partner_id)
      .gte("date", startDate)
      .lte("date", endDate);

    const map: Record<string, Availability> = {};
    (data || []).forEach((a: any) => { map[a.date] = a; });
    setAvailability(map);
  }

  function formatDateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  async function saveAvailability(date: string, status: string, notes?: string, capacity?: number) {
    setSaving(true);
    const existing = availability[date];

    if (status === "available" && existing) {
      // Remove entry (available = default)
      await supabase.from("partner_availability").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("partner_availability").update({
        status,
        notes: notes || null,
        capacity_percent: capacity || (status === "limited" ? 50 : status === "unavailable" ? 0 : 100),
      }).eq("id", existing.id);
    } else if (status !== "available") {
      await supabase.from("partner_availability").insert({
        partner_id: partnerUser.partner_id,
        partner_user_id: partnerUser.id,
        date,
        status,
        notes: notes || null,
        capacity_percent: capacity || (status === "limited" ? 50 : 0),
      });
    }

    await loadAvailability();
    setSaving(false);
  }

  async function saveBulk() {
    if (bulkDates.size === 0) return;
    setSaving(true);

    for (const date of bulkDates) {
      await saveAvailability(date, editMode, editNotes, editMode === "limited" ? editCapacity : undefined);
    }

    setBulkMode(false);
    setBulkDates(new Set());
    setEditNotes("");
    toast.success(`${bulkDates.size} Tage aktualisiert`);
    setSaving(false);
  }

  function toggleBulkDate(dateKey: string) {
    const next = new Set(bulkDates);
    if (next.has(dateKey)) next.delete(dateKey); else next.add(dateKey);
    setBulkDates(next);
  }

  function handleDayClick(dateKey: string) {
    if (dateKey < today) return; // Can't edit past dates
    if (bulkMode) {
      toggleBulkDate(dateKey);
    } else {
      setSelectedDate(selectedDate === dateKey ? null : dateKey);
    }
  }

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  // Stats
  const unavailableDays = Object.values(availability).filter(a => a.status === "unavailable").length;
  const limitedDays = Object.values(availability).filter(a => a.status === "limited").length;
  const workDays = daysInMonth - unavailableDays;

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-[#fa432a]" />
            Verfügbarkeit
          </h1>
          <p className="text-neutral-400 mt-1">
            Teilen Sie BROjekt mit, wann Sie verfügbar sind
          </p>
        </div>
        <button
          onClick={() => { setBulkMode(!bulkMode); setBulkDates(new Set()); }}
          className={`btn-secondary ${bulkMode ? "ring-2 ring-[#fa432a]" : ""}`}
        >
          {bulkMode ? "Abbrechen" : "Mehrere Tage markieren"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{workDays}</p>
          <p className="text-xs text-neutral-500">Verfügbare Tage</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{limitedDays}</p>
          <p className="text-xs text-neutral-500">Eingeschränkt</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{unavailableDays}</p>
          <p className="text-xs text-neutral-500">Nicht verfügbar</p>
        </div>
      </div>

      {/* Bulk Mode Controls */}
      {bulkMode && (
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {(["unavailable", "limited", "available"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setEditMode(s)}
                className={`px-3 py-1.5 rounded text-sm ${editMode === s
                  ? s === "unavailable" ? "bg-red-500/20 text-red-400 ring-1 ring-red-500"
                    : s === "limited" ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500"
                    : "bg-green-500/20 text-green-400 ring-1 ring-green-500"
                  : "bg-[#111] text-neutral-400"
                }`}
              >
                {s === "unavailable" ? "Nicht verfügbar" : s === "limited" ? "Eingeschränkt" : "Verfügbar"}
              </button>
            ))}
          </div>
          {editMode === "limited" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-400">Kapazität:</span>
              <input
                type="range" min="10" max="90" step="10"
                value={editCapacity}
                onChange={(e) => setEditCapacity(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-white">{editCapacity}%</span>
            </div>
          )}
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="input flex-1 min-w-[150px]"
            placeholder="Notiz (optional)"
          />
          <button
            onClick={saveBulk}
            disabled={saving || bulkDates.size === 0}
            className="btn-primary"
          >
            {saving ? <Spinner className="w-4 h-4" /> : `${bulkDates.size} Tage speichern`}
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Calendar */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg">
              <ChevronLeft className="w-5 h-5 text-neutral-400" />
            </button>
            <h2 className="text-lg font-semibold text-white">{monthNames[month]} {year}</h2>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-[#1a1a1a] rounded-lg">
              <ChevronRight className="w-5 h-5 text-neutral-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-sm font-medium text-neutral-500 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="h-16" />;
              const dateKey = formatDateKey(day);
              const avail = availability[dateKey];
              const isPast = dateKey < today;
              const isToday = dateKey === today;
              const isSelected = selectedDate === dateKey;
              const isBulkSelected = bulkDates.has(dateKey);

              let bgClass = "";
              let indicator = null;
              if (avail?.status === "unavailable") {
                bgClass = "bg-red-500/10 border-red-500/30";
                indicator = <X className="w-3 h-3 text-red-400" />;
              } else if (avail?.status === "limited") {
                bgClass = "bg-yellow-500/10 border-yellow-500/30";
                indicator = <AlertCircle className="w-3 h-3 text-yellow-400" />;
              }

              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(dateKey)}
                  disabled={isPast}
                  className={cn(
                    "h-16 p-1 rounded-lg border text-left transition-all relative",
                    isPast ? "opacity-30 cursor-not-allowed border-transparent" : "hover:bg-[#1a1a1a] border-neutral-800 cursor-pointer",
                    bgClass,
                    isSelected && "ring-2 ring-[#fa432a]",
                    isBulkSelected && "ring-2 ring-blue-500 bg-blue-500/10",
                    isToday && !isSelected && "border-[#fa432a]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", isToday ? "text-[#fa432a]" : "text-neutral-300")}>
                      {day}
                    </span>
                    {indicator}
                  </div>
                  {avail?.status === "limited" && (
                    <span className="text-[10px] text-yellow-400">{avail.capacity_percent}%</span>
                  )}
                  {avail?.notes && (
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{avail.notes}</p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" /> Verfügbar</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/30" /> Eingeschränkt</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" /> Nicht verfügbar</span>
          </div>
        </div>

        {/* Day Detail / Quick Edit */}
        <div className="space-y-4">
          {selectedDate && !bulkMode ? (
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-white">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("de-DE", {
                  weekday: "long", day: "numeric", month: "long"
                })}
              </h2>

              <div className="space-y-2">
                {(["available", "limited", "unavailable"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => saveAvailability(selectedDate, s)}
                    disabled={saving}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-colors flex items-center gap-3",
                      availability[selectedDate]?.status === s || (!availability[selectedDate] && s === "available")
                        ? s === "available" ? "border-green-500 bg-green-500/10"
                          : s === "limited" ? "border-yellow-500 bg-yellow-500/10"
                          : "border-red-500 bg-red-500/10"
                        : "border-neutral-800 hover:border-neutral-600"
                    )}
                  >
                    {s === "available" ? <Check className="w-5 h-5 text-green-400" /> :
                     s === "limited" ? <AlertCircle className="w-5 h-5 text-yellow-400" /> :
                     <X className="w-5 h-5 text-red-400" />}
                    <div>
                      <span className="text-white font-medium">
                        {s === "available" ? "Verfügbar" : s === "limited" ? "Eingeschränkt" : "Nicht verfügbar"}
                      </span>
                      <p className="text-xs text-neutral-500">
                        {s === "available" ? "Ganztägig einsetzbar" : s === "limited" ? "Teilweise verfügbar" : "Kein Einsatz möglich"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {availability[selectedDate] && (
                <div>
                  <label className="text-xs text-neutral-500 block mb-1">Notiz</label>
                  <input
                    type="text"
                    defaultValue={availability[selectedDate]?.notes || ""}
                    onBlur={(e) => {
                      if (availability[selectedDate]) {
                        saveAvailability(selectedDate, availability[selectedDate].status, e.target.value, availability[selectedDate].capacity_percent);
                      }
                    }}
                    className="input w-full"
                    placeholder="z.B. Urlaub, Arzttermin..."
                  />
                </div>
              )}
            </div>
          ) : !bulkMode ? (
            <div className="card p-8 text-center text-neutral-500">
              <CalendarDays className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
              <p>Tag auswählen um Verfügbarkeit zu setzen</p>
            </div>
          ) : null}

          {/* Quick Actions */}
          <div className="card p-4 space-y-2">
            <h3 className="text-sm font-medium text-neutral-400 mb-2">Schnellaktionen</h3>
            <button
              onClick={() => {
                // Mark all weekends as unavailable
                const dates: string[] = [];
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateKey = formatDateKey(d);
                  if (dateKey < today) continue;
                  const dow = new Date(year, month, d).getDay();
                  if (dow === 0 || dow === 6) dates.push(dateKey);
                }
                setBulkMode(true);
                setBulkDates(new Set(dates));
                setEditMode("unavailable");
              }}
              className="w-full btn-secondary text-sm text-left"
            >
              🗓️ Alle Wochenenden markieren
            </button>
            <button
              onClick={async () => {
                // Mark whole next week as available (remove entries)
                setSaving(true);
                const nextMonday = new Date();
                nextMonday.setDate(nextMonday.getDate() + (8 - nextMonday.getDay()) % 7);
                for (let i = 0; i < 5; i++) {
                  const d = new Date(nextMonday);
                  d.setDate(d.getDate() + i);
                  const key = d.toISOString().split("T")[0];
                  if (availability[key]) {
                    await supabase.from("partner_availability").delete().eq("id", availability[key].id);
                  }
                }
                await loadAvailability();
                setSaving(false);
                toast.success("Nächste Woche als verfügbar markiert");
              }}
              className="w-full btn-secondary text-sm text-left"
            >
              ✅ Nächste Woche = Verfügbar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
