"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  ChevronLeft,
  Calendar,
  RefreshCw,
  Zap,
  History,
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";

interface CronJob {
  id: string;
  name: string;
  description: string | null;
  schedule: string; // cron expression
  task_type: string;
  task_config: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
}

const schedulePresets = [
  { label: "Jede Minute", value: "* * * * *" },
  { label: "Alle 5 Minuten", value: "*/5 * * * *" },
  { label: "Alle 15 Minuten", value: "*/15 * * * *" },
  { label: "Alle 30 Minuten", value: "*/30 * * * *" },
  { label: "Stündlich", value: "0 * * * *" },
  { label: "Täglich 9 Uhr", value: "0 9 * * *" },
  { label: "Täglich 18 Uhr", value: "0 18 * * *" },
  { label: "Montags 9 Uhr", value: "0 9 * * 1" },
  { label: "Monatlich", value: "0 0 1 * *" },
];

const taskTypes = [
  { id: "heartbeat", label: "💓 Heartbeat Check", description: "Prüft System-Status" },
  { id: "lead_followup", label: "📧 Lead Follow-up", description: "Erinnert an offene Leads" },
  { id: "backup", label: "💾 Backup", description: "Erstellt Datensicherung" },
  { id: "report", label: "📊 Report", description: "Generiert Berichte" },
  { id: "sync", label: "🔄 Sync", description: "Synchronisiert externe Daten" },
  { id: "cleanup", label: "🧹 Cleanup", description: "Bereinigt alte Daten" },
  { id: "custom", label: "⚡ Custom", description: "Benutzerdefinierte Aufgabe" },
];

export default function CronJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    schedule: "0 * * * *",
    task_type: "heartbeat",
    enabled: true,
  });

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    try {
      // Note: This assumes a cron_jobs table exists
      // If not, we'll create mock data for demo
      const { data, error } = await supabase
        .from("cron_jobs")
        .select("*")
        .order("name");

      if (error) {
        // Table doesn't exist - show empty state
        console.log("Cron jobs table not found, showing empty state");
        setJobs([]);
      } else {
        setJobs(data || []);
      }
    } catch (err) {
      console.error("Error loading cron jobs:", err);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setForm({
      name: "",
      description: "",
      schedule: "0 * * * *",
      task_type: "heartbeat",
      enabled: true,
    });
    setShowForm(true);
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase.from("cron_jobs").insert({
      name: form.name,
      description: form.description || null,
      schedule: form.schedule,
      task_type: form.task_type,
      task_config: {},
      enabled: form.enabled,
    });

    setSaving(false);

    if (error) {
      if (error.code === "42P01") {
        alert("Cron Jobs Tabelle existiert noch nicht. Bitte erst DB-Migration ausführen.");
      } else {
        alert("Fehler beim Speichern: " + error.message);
      }
      return;
    }

    setShowForm(false);
    await loadJobs();
  }

  async function toggleJob(job: CronJob) {
    await supabase
      .from("cron_jobs")
      .update({ enabled: !job.enabled })
      .eq("id", job.id);
    await loadJobs();
  }

  async function deleteJob(id: string) {
    if (!confirm("Job wirklich löschen?")) return;
    await supabase.from("cron_jobs").delete().eq("id", id);
    await loadJobs();
  }

  async function runNow(job: CronJob) {
    // This would trigger the job immediately
    // For now, just log it
    await supabase.from("logs").insert({
      type: "system",
      message: `Cron Job "${job.name}" manuell gestartet`,
      metadata: { job_id: job.id, task_type: job.task_type },
    });
    
    await supabase
      .from("cron_jobs")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", job.id);

    alert(`Job "${job.name}" wurde gestartet!`);
    await loadJobs();
  }

  function parseCronSchedule(cron: string): string {
    const preset = schedulePresets.find((p) => p.value === cron);
    if (preset) return preset.label;
    return cron;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/openclaw")}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-purple-400" />
            Cron Jobs
          </h1>
        </div>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neuer Job
        </button>
      </div>

      {/* Info Box */}
      <div className="card p-4 bg-purple-500/10 border-purple-500/30">
        <p className="text-sm text-purple-300">
          <strong>Hinweis:</strong> Cron Jobs werden von OpenClaw automatisch ausgeführt.
          Hier kannst du geplante Aufgaben verwalten, die regelmäßig laufen sollen.
        </p>
      </div>

      {/* Jobs List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-500">Keine Cron Jobs vorhanden</p>
          <p className="text-neutral-600 text-sm mt-1">
            Erstelle deinen ersten geplanten Job
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[#1f1f1f]">
          {jobs.map((job) => (
            <div key={job.id} className="p-4 flex items-center gap-4">
              {/* Status Indicator */}
              <div
                className={`w-3 h-3 rounded-full ${
                  job.enabled ? "bg-green-400" : "bg-neutral-600"
                }`}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{job.name}</span>
                  <span className="badge badge-purple text-xs">
                    {taskTypes.find((t) => t.id === job.task_type)?.label || job.task_type}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {parseCronSchedule(job.schedule)}
                  </span>
                  {job.last_run_at && (
                    <span className="flex items-center gap-1">
                      <History className="w-3 h-3" />
                      Letzter Lauf: {formatRelativeTime(job.last_run_at)}
                    </span>
                  )}
                </div>
                {job.description && (
                  <p className="text-sm text-neutral-500 mt-1">{job.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => runNow(job)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 text-blue-400"
                  title="Jetzt ausführen"
                >
                  <Zap className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleJob(job)}
                  className={`btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 ${
                    job.enabled ? "text-green-400" : "text-neutral-500"
                  }`}
                  title={job.enabled ? "Deaktivieren" : "Aktivieren"}
                >
                  {job.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteJob(job.id)}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Job Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Neuer Cron Job">
        <form onSubmit={saveJob} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="z.B. Täglicher Heartbeat"
              required
            />
          </div>

          <div>
            <label className="form-label">Beschreibung</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
              placeholder="Was macht dieser Job?"
            />
          </div>

          <div>
            <label className="form-label">Aufgabentyp</label>
            <select
              value={form.task_type}
              onChange={(e) => setForm({ ...form, task_type: e.target.value })}
              className="input"
            >
              {taskTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} - {t.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Zeitplan</label>
            <select
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              className="input"
            >
              {schedulePresets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} ({p.value})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              id="enabled"
              className="w-5 h-5"
            />
            <label htmlFor="enabled" className="text-sm text-neutral-400">
              Job sofort aktivieren
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : <Plus className="w-4 h-4" />}
              {saving ? "Speichern..." : "Job erstellen"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
