"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  Bot,
  Activity,
  Brain,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw,
  Play,
  Pause,
  FileText,
} from "lucide-react";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import type { Log, Skill } from "@/types/database";

interface Stats {
  totalLogs: number;
  todayLogs: number;
  activeSkills: number;
  totalSkills: number;
  lastHeartbeat: string | null;
  errors24h: number;
}

export default function OpenClawPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentLogs, setRecentLogs] = useState<Log[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const [logsRes, todayLogsRes, skillsRes, heartbeatRes, errorsRes] = await Promise.all([
        supabase.from("logs").select("*", { count: "exact", head: true }),
        supabase.from("logs").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("skills").select("*").order("name"),
        supabase.from("logs").select("created_at").eq("type", "heartbeat").order("created_at", { ascending: false }).limit(1),
        supabase.from("logs").select("*", { count: "exact", head: true }).eq("type", "error").gte("created_at", yesterday.toISOString()),
      ]);

      const activeSkills = (skillsRes.data || []).filter((s) => s.active);

      setStats({
        totalLogs: logsRes.count || 0,
        todayLogs: todayLogsRes.count || 0,
        activeSkills: activeSkills.length,
        totalSkills: skillsRes.data?.length || 0,
        lastHeartbeat: heartbeatRes.data?.[0]?.created_at || null,
        errors24h: errorsRes.count || 0,
      });

      setSkills(skillsRes.data || []);

      // Load recent logs
      const { data: logs } = await supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      setRecentLogs(logs || []);
    } catch (err) {
      console.error("Error loading openclaw data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSkill(skill: Skill) {
    await supabase
      .from("skills")
      .update({ active: !skill.active, updated_at: new Date().toISOString() })
      .eq("id", skill.id);
    await loadData();
  }

  async function logHeartbeat() {
    await supabase.from("logs").insert({
      type: "heartbeat",
      message: "Manual heartbeat triggered from dashboard",
      metadata: { source: "dashboard", timestamp: new Date().toISOString() },
    });
    await loadData();
  }

  const typeIcons: Record<string, React.ReactNode> = {
    heartbeat: <Activity className="w-4 h-4 text-green-400" />,
    task: <CheckCircle className="w-4 h-4 text-blue-400" />,
    lead: <Zap className="w-4 h-4 text-yellow-400" />,
    email: <FileText className="w-4 h-4 text-purple-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    system: <Settings className="w-4 h-4 text-neutral-400" />,
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Spinner className="mx-auto" />
        <p className="text-neutral-500 mt-4">Lade Dashboard...</p>
      </div>
    );
  }

  const heartbeatStatus = stats?.lastHeartbeat
    ? new Date().getTime() - new Date(stats.lastHeartbeat).getTime() < 60 * 60 * 1000
      ? "online"
      : "idle"
    : "unknown";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-3">
          <Bot className="w-7 h-7 text-orange-400" />
          OpenClaw Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            heartbeatStatus === "online"
              ? "bg-green-500/20 text-green-400"
              : heartbeatStatus === "idle"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-neutral-500/20 text-neutral-400"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              heartbeatStatus === "online" ? "bg-green-400 animate-pulse" : 
              heartbeatStatus === "idle" ? "bg-yellow-400" : "bg-neutral-400"
            }`} />
            {heartbeatStatus === "online" ? "Online" : heartbeatStatus === "idle" ? "Idle" : "Unbekannt"}
          </span>
          <button onClick={loadData} className="btn btn-ghost btn-icon" title="Aktualisieren">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Activity className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.todayLogs || 0}</p>
              <p className="text-xs text-neutral-500">Logs heute</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {stats?.activeSkills}/{stats?.totalSkills}
              </p>
              <p className="text-xs text-neutral-500">Skills aktiv</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {stats?.lastHeartbeat ? formatRelativeTime(stats.lastHeartbeat) : "—"}
              </p>
              <p className="text-xs text-neutral-500">Letzter Heartbeat</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stats?.errors24h ? "bg-red-500/20" : "bg-neutral-500/20"}`}>
              <AlertCircle className={`w-5 h-5 ${stats?.errors24h ? "text-red-400" : "text-neutral-400"}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats?.errors24h || 0}</p>
              <p className="text-xs text-neutral-500">Fehler (24h)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Letzte Aktivität
            </h2>
            <a href="/logs" className="text-sm text-orange-400 hover:text-orange-300">
              Alle Logs →
            </a>
          </div>
          <div className="divide-y divide-[#1f1f1f] max-h-[400px] overflow-y-auto">
            {recentLogs.length === 0 ? (
              <p className="p-4 text-neutral-500 text-center">Keine Logs</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-start gap-3">
                  {typeIcons[log.type] || <FileText className="w-4 h-4 text-neutral-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{log.message || "—"}</p>
                    <p className="text-xs text-neutral-500">{log.created_at ? formatRelativeTime(log.created_at) : "—"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Skills */}
        <div className="card">
          <div className="p-4 border-b border-[#1f1f1f] flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-400" />
              Skills
            </h2>
            <a href="/skills" className="text-sm text-orange-400 hover:text-orange-300">
              Alle Skills →
            </a>
          </div>
          <div className="divide-y divide-[#1f1f1f] max-h-[400px] overflow-y-auto">
            {skills.length === 0 ? (
              <p className="p-4 text-neutral-500 text-center">Keine Skills</p>
            ) : (
              skills.map((skill) => (
                <div key={skill.id} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${skill.active ? "bg-green-400" : "bg-neutral-600"}`} />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{skill.name}</p>
                      <p className="text-xs text-neutral-500">{skill.trigger}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSkill(skill)}
                    className={`btn btn-ghost btn-sm ${skill.active ? "text-green-400" : "text-neutral-500"}`}
                    title={skill.active ? "Deaktivieren" : "Aktivieren"}
                  >
                    {skill.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={logHeartbeat} className="btn btn-secondary">
            <Activity className="w-4 h-4" />
            Heartbeat auslösen
          </button>
          <a href="/skills" className="btn btn-secondary">
            <Brain className="w-4 h-4" />
            Skills verwalten
          </a>
          <a href="/logs" className="btn btn-secondary">
            <FileText className="w-4 h-4" />
            Logs ansehen
          </a>
          <a href="/openclaw/cron" className="btn btn-secondary">
            <Clock className="w-4 h-4" />
            Cron Jobs
          </a>
        </div>
      </div>

      {/* System Info */}
      <div className="card p-4 bg-[#111] text-sm">
        <h3 className="text-neutral-400 text-xs uppercase tracking-wide mb-2">System Info</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-neutral-500">
          <div>
            <span className="text-neutral-400">Agent:</span> Cody (BROjekt)
          </div>
          <div>
            <span className="text-neutral-400">Logs total:</span> {stats?.totalLogs || 0}
          </div>
          <div>
            <span className="text-neutral-400">Stand:</span> {formatDate(new Date().toISOString())}
          </div>
        </div>
      </div>
    </div>
  );
}
