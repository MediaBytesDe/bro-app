"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { INQUIRY_STATUS_MAP, URGENCY_MAP } from "@/lib/inquiries/constants";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import type { InquiryStatus } from "@/lib/inquiries/types";

interface InquiryRow {
  id: string;
  title: string;
  trade: string;
  status: InquiryStatus;
  urgency: string;
  mode: "direct" | "tender";
  created_at: string;
  project: { id: string; name: string } | null;
  recipients: {
    id: string;
    partner_id: string;
    status: string;
    partner: { id: string; company_name: string } | null;
  }[];
}

type StatusFilter = "all" | InquiryStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "draft", label: "Entwurf" },
  { key: "sent", label: "Gesendet" },
  { key: "in_review", label: "In Prüfung" },
  { key: "answered", label: "Beantwortet" },
  { key: "accepted", label: "Akzeptiert" },
  { key: "declined", label: "Abgelehnt" },
  { key: "closed", label: "Abgeschlossen" },
];

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getRecipientDisplay(recipients: InquiryRow["recipients"]): string {
  if (!recipients || recipients.length === 0) return "–";
  if (recipients.length === 1) {
    return recipients[0].partner?.company_name || "1 Empfänger";
  }
  return `${recipients.length} Empfänger`;
}

export default function InquiryListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<InquiryRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Load trade labels from DB
      await loadTradesFromDB(supabase, true);

      const { data, error } = await supabase
        .from("inquiries")
        .select(`
          *,
          project:projects(id, name),
          recipients:inquiry_recipients(
            id, partner_id, status,
            partner:partners(id, company_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading inquiries:", error);
      }

      setInquiries((data as InquiryRow[]) || []);
    } catch (err) {
      console.error("Error loading inquiries:", err);
    } finally {
      setLoading(false);
    }
  }

  const filteredInquiries = inquiries.filter((inq) => {
    if (filter === "all") return true;
    return inq.status === filter;
  });

  const filterCounts = STATUS_FILTERS.map((f) => ({
    ...f,
    count:
      f.key === "all"
        ? inquiries.length
        : inquiries.filter((inq) => inq.status === f.key).length,
  }));

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
            <ClipboardList className="w-7 h-7 text-[#fa432a]" />
            Anfragen
          </h1>
          <p className="text-neutral-400 mt-1">
            {filteredInquiries.length}{" "}
            {filteredInquiries.length === 1 ? "Anfrage" : "Anfragen"}
          </p>
        </div>
        <Link
          href="/anfragen/neu"
          className="flex items-center gap-2 px-4 py-2.5 bg-[#fa432a] hover:bg-[#e03820] text-white rounded-xl font-medium transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Neue Anfrage
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterCounts.map((f) => (
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

      {/* Content */}
      {filteredInquiries.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Keine Anfragen gefunden</p>
          <p className="text-neutral-500 text-sm mt-1 mb-6">
            {filter === "all"
              ? "Erstellen Sie Ihre erste Anfrage an Nachunternehmer."
              : "Keine Anfragen mit diesem Status vorhanden."}
          </p>
          {filter === "all" && (
            <Link
              href="/anfragen/neu"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#fa432a] hover:bg-[#e03820] text-white rounded-xl font-medium transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Neue Anfrage erstellen
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Titel
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Status
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">
                    Gewerk
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">
                    Dringlichkeit
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">
                    Modus
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden xl:table-cell">
                    Projekt
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">
                    Empfänger
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Erstellt
                  </th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filteredInquiries.map((inq) => {
                  const statusInfo = INQUIRY_STATUS_MAP[inq.status] || {
                    label: inq.status,
                    class: "bg-neutral-500/20 text-neutral-400",
                  };
                  const urgencyInfo = URGENCY_MAP[inq.urgency] || {
                    label: inq.urgency,
                    class: "bg-neutral-500/20 text-neutral-400",
                  };

                  return (
                    <tr
                      key={inq.id}
                      className="border-b border-neutral-800/50 hover:bg-[#111] transition-colors cursor-pointer"
                      onClick={() => router.push(`/anfragen/${inq.id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className="font-medium text-white">
                          {inq.title}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded ${statusInfo.class}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                          {getTradeLabel(inq.trade)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span
                          className={`text-xs px-2 py-1 rounded ${urgencyInfo.class}`}
                        >
                          {urgencyInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell">
                        <span className="text-neutral-400 text-sm">
                          {inq.mode === "direct" ? "Direkt" : "Ausschreibung"}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden xl:table-cell">
                        <span className="text-neutral-400 text-sm">
                          {inq.project?.name || "–"}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-neutral-300 text-sm">
                          {getRecipientDisplay(inq.recipients)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-neutral-400 text-sm whitespace-nowrap">
                          {formatDateShort(inq.created_at)}
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
          <div className="space-y-3 md:hidden">
            {filteredInquiries.map((inq) => {
              const statusInfo = INQUIRY_STATUS_MAP[inq.status] || {
                label: inq.status,
                class: "bg-neutral-500/20 text-neutral-400",
              };
              const urgencyInfo = URGENCY_MAP[inq.urgency] || {
                label: inq.urgency,
                class: "bg-neutral-500/20 text-neutral-400",
              };

              return (
                <Link
                  key={inq.id}
                  href={`/anfragen/${inq.id}`}
                  className="card block p-4 hover:bg-[#111] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">
                        {inq.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${statusInfo.class}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${urgencyInfo.class}`}
                        >
                          {urgencyInfo.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">
                          {getTradeLabel(inq.trade)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
                        <span>
                          {inq.mode === "direct" ? "Direkt" : "Ausschreibung"}
                        </span>
                        <span>·</span>
                        <span>{getRecipientDisplay(inq.recipients)}</span>
                        {inq.project && (
                          <>
                            <span>·</span>
                            <span className="truncate">{inq.project.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-neutral-500">
                        {formatDateShort(inq.created_at)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-neutral-600" />
                    </div>
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
