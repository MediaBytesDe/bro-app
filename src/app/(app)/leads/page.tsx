"use client";

import { useState } from "react";
import { LeadsTable } from "@/components/leads-table";
import { LeadsKanban } from "@/components/leads-kanban";
import { LayoutGrid, List, Plus } from "lucide-react";

export default function LeadsPage() {
  const [view, setView] = useState<"list" | "kanban">("kanban");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Lead Management</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#1a1a1a] rounded-lg p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                view === "kanban"
                  ? "bg-[var(--accent-primary)] text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Pipeline</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all ${
                view === "list"
                  ? "bg-[var(--accent-primary)] text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {view === "kanban" ? <LeadsKanban /> : <LeadsTable />}
    </div>
  );
}
