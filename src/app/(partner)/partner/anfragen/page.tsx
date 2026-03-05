"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import {
  FileQuestion,
  Calendar,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import { URGENCY_MAP, RECIPIENT_STATUS_MAP } from "@/lib/inquiries/constants";
import type { RecipientStatus, InquiryUrgency } from "@/lib/inquiries/types";

interface InquiryRecipientRow {
  id: string;
  inquiry_id: string;
  partner_id: string;
  status: RecipientStatus;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  inquiry: {
    id: string;
    title: string;
    description: string | null;
    trade: string;
    urgency: InquiryUrgency;
    status: string;
    mode: string;
    created_at: string;
    project?: { id: string; name: string } | null;
  };
}

type FilterType = "all" | "pending" | "viewed" | "responded";

export default function PartnerInquiriesPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterType) || "all";

  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<InquiryRecipientRow[]>([]);
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load trades from DB (for labels)
      await loadTradesFromDB(supabase, true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) { setLoading(false); return; }

      // Load inquiries via partner API
      const res = await fetch("/api/partner/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });

      const json = await res.json();
      if (json.data) {
        setRecipients(json.data);
      }
    } catch (err) {
      console.error("Error loading inquiries:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredRecipients = recipients.filter((r) => {
    switch (filter) {
      case "pending":
        return r.status === "pending";
      case "viewed":
        return r.status === "viewed";
      case "responded":
        return r.status === "responded" || r.status === "accepted" || r.status === "declined";
      default:
        return true;
    }
  });

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: "all", label: "Alle", count: recipients.length },
    { key: "pending", label: "Neu", count: recipients.filter((r) => r.status === "pending").length },
    { key: "viewed", label: "In Bearbeitung", count: recipients.filter((r) => r.status === "viewed").length },
    {
      key: "responded",
      label: "Beantwortet",
      count: recipients.filter((r) => r.status === "responded" || r.status === "accepted" || r.status === "declined").length,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileQuestion className="w-7 h-7 text-[#fa432a]" />
            Anfragen
          </h1>
          <p className="text-neutral-400 mt-1">
            {filteredRecipients.length} {filteredRecipients.length === 1 ? "Anfrage" : "Anfragen"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-[#fa432a] text-white"
                : "bg-[#111] text-neutral-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                  filter === f.key ? "bg-[#fa432a]" : "bg-[#222]"
                }`}
              >
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Inquiries List */}
      {filteredRecipients.length === 0 ? (
        <div className="card p-12 text-center">
          <FileQuestion className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Anfragen vorhanden</p>
          <p className="text-neutral-500 text-sm mt-1">
            {filter === "pending"
              ? "Aktuell keine neuen Anfragen"
              : "Ändern Sie den Filter um andere Anfragen zu sehen"}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card overflow-hidden hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Status</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Titel</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">Gewerk</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">Dringlichkeit</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">Projekt</th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">Erhalten am</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipients.map((r) => {
                  const statusInfo = RECIPIENT_STATUS_MAP[r.status] || {
                    label: r.status,
                    class: "bg-neutral-500/20 text-neutral-400",
                  };
                  const urgencyInfo = URGENCY_MAP[r.inquiry.urgency] || {
                    label: r.inquiry.urgency,
                    class: "bg-neutral-500/20 text-neutral-400",
                  };

                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-neutral-800/50 hover:bg-[#111] transition-colors cursor-pointer ${
                        r.status === "pending" ? "border-l-2 border-l-yellow-500" : ""
                      }`}
                      onClick={() => (window.location.href = `/partner/anfragen/${r.inquiry_id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded ${statusInfo.class}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">{r.inquiry.title}</span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                          {getTradeLabel(r.inquiry.trade)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className={`text-xs px-2 py-1 rounded ${urgencyInfo.class}`}>
                          {urgencyInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        {r.inquiry.project ? (
                          <span className="text-neutral-400 text-sm flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-neutral-500" />
                            {r.inquiry.project.name}
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-sm">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell">
                        <span className="text-neutral-300 text-sm flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                          {formatDate(r.created_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <ChevronRight className="w-4 h-4 text-neutral-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="space-y-3 sm:hidden">
            {filteredRecipients.map((r) => {
              const statusInfo = RECIPIENT_STATUS_MAP[r.status] || {
                label: r.status,
                class: "bg-neutral-500/20 text-neutral-400",
              };
              const urgencyInfo = URGENCY_MAP[r.inquiry.urgency] || {
                label: r.inquiry.urgency,
                class: "bg-neutral-500/20 text-neutral-400",
              };

              return (
                <Link
                  key={r.id}
                  href={`/partner/anfragen/${r.inquiry_id}`}
                  className={`card p-4 block hover:bg-[#111] transition-colors ${
                    r.status === "pending" ? "border-l-2 border-l-yellow-500" : ""
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-white text-sm flex-1 mr-2">
                      {r.inquiry.title}
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusInfo.class}`}>
                      {statusInfo.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${urgencyInfo.class}`}>
                      {urgencyInfo.label}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                      {getTradeLabel(r.inquiry.trade)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    {r.inquiry.project ? (
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        {r.inquiry.project.name}
                      </span>
                    ) : (
                      <span>-</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
