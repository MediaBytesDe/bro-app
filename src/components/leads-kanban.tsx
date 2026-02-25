"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { formatValue } from "@/lib/utils";
import {
  Plus, Phone, Mail, Building2, GripVertical,
  ChevronDown, ChevronUp, MoreHorizontal, User,
  TrendingUp, Clock
} from "lucide-react";
import type { Lead } from "@/types/database";

// Pipeline stages in order
const STAGES = [
  { key: "new", label: "Neu", color: "#3b82f6", bgColor: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.3)" },
  { key: "contacted", label: "Kontaktiert", color: "#f59e0b", bgColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  { key: "qualified", label: "Qualifiziert", color: "#8b5cf6", bgColor: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.3)" },
  { key: "proposal", label: "Angebot", color: "#f97316", bgColor: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.3)" },
  { key: "negotiation", label: "Verhandlung", color: "#06b6d4", bgColor: "rgba(6,182,212,0.1)", borderColor: "rgba(6,182,212,0.3)" },
  { key: "won", label: "Gewonnen", color: "#22c55e", bgColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)" },
  { key: "lost", label: "Verloren", color: "#ef4444", bgColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
] as const;

type StageKey = typeof STAGES[number]["key"];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function LeadCard({
  lead,
  onDragStart,
  onClick,
}: {
  lead: Lead;
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={onClick}
      className="group bg-[#1a1a1a] rounded-lg p-3 cursor-pointer 
                 hover:bg-[#222] transition-all duration-150 
                 border border-[#262626] hover:border-[#333]
                 active:scale-[0.98] select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-white text-sm truncate">{lead.name}</h4>
          {lead.company && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="text-xs text-neutral-400 truncate">{lead.company}</span>
            </div>
          )}
        </div>
        {lead.value && (
          <span className="text-green-400 font-bold text-xs whitespace-nowrap bg-green-400/10 px-1.5 py-0.5 rounded">
            {formatValue(lead.value)}
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
        {lead.email && (
          <span className="flex items-center gap-0.5 truncate max-w-[140px]">
            <Mail className="w-3 h-3" />
            {lead.email}
          </span>
        )}
        {lead.phone && (
          <span className="flex items-center gap-0.5">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#262626]">
        <div className="flex items-center gap-2">
          {lead.source && (
            <span className="text-[10px] text-neutral-600 bg-[#1f1f1f] px-1.5 py-0.5 rounded">
              {lead.source}
            </span>
          )}
        </div>
        <span className="text-[10px] text-neutral-600 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(lead.created_at)}
        </span>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  leads,
  onDragStart,
  onDrop,
  onDragOver,
  onCardClick,
  collapsed,
  onToggleCollapse,
}: {
  stage: typeof STAGES[number];
  leads: Lead[];
  onDragStart: (e: React.DragEvent, lead: Lead) => void;
  onDrop: (e: React.DragEvent, stageKey: StageKey) => void;
  onDragOver: (e: React.DragEvent) => void;
  onCardClick: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[320px] shrink-0 rounded-xl transition-all duration-200 ${
        isDragOver ? "ring-2 ring-[var(--accent-primary)] ring-opacity-50" : ""
      }`}
      style={{ background: stage.bgColor }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e, stage.key);
      }}
    >
      {/* Column Header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer"
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="font-semibold text-sm text-white">{stage.label}</span>
          <span className="text-xs text-neutral-500 bg-[#1a1a1a] px-1.5 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalValue > 0 && (
            <span className="text-xs text-green-400 font-medium">{formatValue(totalValue)}</span>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          )}
        </div>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-250px)] scrollbar-thin">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onDragStart={onDragStart}
              onClick={() => onCardClick(lead.id)}
            />
          ))}
          {leads.length === 0 && (
            <div className="text-center py-8 text-neutral-600 text-xs">
              Keine Leads
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadsKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadLeads();
    // Safety timeout: force loading off if query hangs
    const timeout = setTimeout(() => {
      setLoading((v) => {
        if (v) console.warn("Leads kanban safety timeout: forcing loading to false");
        return false;
      });
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  async function loadLeads() {
    setLoading(true);
    try {
      const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      setLeads(data || []);
    } catch (err) {
      console.error("Leads load error:", err);
    } finally {
      setLoading(false);
    }
  }

  const leadsByStage = STAGES.reduce((acc, stage) => {
    acc[stage.key] = leads.filter((l) => (l.status || "new") === stage.key);
    return acc;
  }, {} as Record<StageKey, Lead[]>);

  function handleDragStart(e: React.DragEvent, lead: Lead) {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }

  async function handleDrop(e: React.DragEvent, targetStage: StageKey) {
    e.preventDefault();
    if (!draggedLead || draggedLead.status === targetStage) {
      setDraggedLead(null);
      return;
    }

    // Optimistic update
    const oldStatus = draggedLead.status;
    setLeads((prev) =>
      prev.map((l) => (l.id === draggedLead.id ? { ...l, status: targetStage } : l))
    );
    setDraggedLead(null);

    // Persist
    const { error } = await supabase
      .from("leads")
      .update({ status: targetStage })
      .eq("id", draggedLead.id);

    if (error) {
      // Rollback on error
      setLeads((prev) =>
        prev.map((l) => (l.id === draggedLead.id ? { ...l, status: oldStatus } : l))
      );
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function toggleCollapse(key: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Stats
  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);
  const wonLeads = leads.filter((l) => l.status === "won");
  const wonValue = wonLeads.reduce((sum, l) => sum + (l.value || 0), 0);
  const conversionRate = totalLeads > 0 ? ((wonLeads.length / totalLeads) * 100).toFixed(1) : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Pipeline</div>
          <div className="text-lg font-bold text-white">{totalLeads} Leads</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Gesamtwert</div>
          <div className="text-lg font-bold text-green-400">{formatValue(totalValue)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Gewonnen</div>
          <div className="text-lg font-bold text-green-400">{formatValue(wonValue)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Conversion
          </div>
          <div className="text-lg font-bold text-white">{conversionRate}%</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              leads={leadsByStage[stage.key] || []}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onCardClick={(id) => router.push(`/leads/${id}`)}
              collapsed={collapsedCols.has(stage.key)}
              onToggleCollapse={() => toggleCollapse(stage.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
