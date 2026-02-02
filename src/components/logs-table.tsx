"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  Activity,
  User,
  Mail,
  AlertCircle,
  ListTodo,
  Settings,
  FileText,
  RefreshCw,
  Clock,
} from "lucide-react";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import type { Log } from "@/types/database";

const typeConfig: Record<string, { icon: React.ElementType; class: string; label: string }> = {
  heartbeat: { icon: Activity, class: "badge-success", label: "Heartbeat" },
  lead: { icon: User, class: "badge-info", label: "Lead" },
  email: { icon: Mail, class: "badge-purple", label: "Email" },
  error: { icon: AlertCircle, class: "badge-error", label: "Error" },
  task: { icon: ListTodo, class: "badge-warning", label: "Task" },
  system: { icon: Settings, class: "badge-gray", label: "System" },
};

export function LogsTable() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadLogs();
  }, [typeFilter]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadLogs, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, typeFilter]);

  async function loadLogs() {
    setLoading(true);
    let query = supabase.from("logs").select("*").order("created_at", { ascending: false }).limit(50);

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    const { data } = await query;
    setLogs(data || []);
    setLoading(false);
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-400" />
          <span className="font-medium text-sm">{logs.length} Logs</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input text-xs py-1 px-2 w-auto"
          >
            <option value="all">Alle</option>
            <option value="heartbeat">Heartbeat</option>
            <option value="task">Task</option>
            <option value="lead">Lead</option>
            <option value="email">Email</option>
            <option value="error">Error</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn btn-ghost btn-icon ${autoRefresh ? "text-green-400" : ""}`}
            title={autoRefresh ? "Auto-Refresh An" : "Auto-Refresh Aus"}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="empty-state py-8">
          <Spinner />
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state py-8">Keine Logs</div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {logs.map((log) => {
            const config = typeConfig[log.type] || { icon: FileText, class: "badge-gray", label: log.type };
            const Icon = config.icon;

            return (
              <button
                key={log.id}
                className="list-item w-full text-left cursor-pointer"
                onClick={() => setSelectedLog(log)}
              >
                <span className={`badge ${config.class} flex items-center gap-1`}>
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{config.label}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{log.message || "—"}</p>
                </div>
                <span className="text-xs text-neutral-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {log.created_at ? formatRelativeTime(log.created_at) : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Log Detail Modal */}
      <Modal open={!!selectedLog} onClose={() => setSelectedLog(null)}>
        {selectedLog && (
          <>
            <div className="flex items-center gap-2 mb-4">
              {(() => {
                const config = typeConfig[selectedLog.type] || { icon: FileText, class: "badge-gray", label: selectedLog.type };
                const Icon = config.icon;
                return (
                  <span className={`badge ${config.class}`}>
                    <Icon className="w-3 h-3 mr-1" />
                    {config.label}
                  </span>
                );
              })()}
            </div>

            <div className="space-y-3">
              <div>
                <div className="form-label">Nachricht</div>
                <p className="text-sm">{selectedLog.message || "—"}</p>
              </div>

              <div>
                <div className="form-label">Zeitpunkt</div>
                <p className="text-sm text-neutral-400">{formatDate(selectedLog.created_at)}</p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <div className="form-label">Metadata</div>
                  <pre className="text-xs bg-[#0a0a0a] p-3 rounded-lg overflow-x-auto text-neutral-300">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <div className="form-label">ID</div>
                <p className="text-xs text-neutral-500 font-mono">{selectedLog.id}</p>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
