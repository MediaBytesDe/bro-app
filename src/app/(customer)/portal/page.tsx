"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { FolderOpen, FileText, Calendar, Clock, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CustomerPortalPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [profile]);

  async function loadData() {
    if (!profile?.auth_id) return;

    // Find customer by auth_user_id
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", profile.auth_id)
      .single();

    if (!customer) {
      setLoading(false);
      return;
    }

    setCustomerId(customer.id);

    // Load projects for this customer
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, name, slug, icon, workfolder_status, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);

    setProjects(projectsData || []);

    // Load quotes for this customer
    const { data: quotesData } = await supabase
      .from("wawi_quotes")
      .select("id, title, package_title, lexware_quote_number, status, total_amount, quote_date, lexware_quotation_id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);

    setQuotes(quotesData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Willkommen, {profile?.display_name?.split(" ")[0] || "Kunde"}!
        </h1>
        <p className="text-neutral-400 mt-1">
          Hier finden Sie einen Überblick über Ihre Projekte und Angebote.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Projekte"
          value={projects.length}
          color="orange"
        />
        <StatCard
          icon={FileText}
          label="Angebote"
          value={quotes.length}
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="Offen"
          value={quotes.filter(q => q.status === "sent").length}
          color="yellow"
        />
        <StatCard
          icon={Calendar}
          label="Angenommen"
          value={quotes.filter(q => q.status === "accepted").length}
          color="green"
        />
      </div>

      {/* Recent Projects */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-orange-400" />
            Aktuelle Projekte
          </h2>
          {projects.length > 0 && (
            <Link href="/portal/projekte" className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="card p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
            <p className="text-neutral-400">Noch keine Projekte vorhanden</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/portal/projekte/${project.slug}`}
                className="card p-4 flex items-center justify-between hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{project.icon || "📁"}</span>
                  <div>
                    <h3 className="font-medium text-white">{project.name}</h3>
                    <p className="text-xs text-neutral-500">{formatDate(project.created_at)}</p>
                  </div>
                </div>
                <StatusBadge status={project.workfolder_status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Quotes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            Angebote
          </h2>
          {quotes.length > 0 && (
            <Link href="/portal/angebote" className="text-sm text-[#fa432a] hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {quotes.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
            <p className="text-neutral-400">Noch keine Angebote vorhanden</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {quotes.map((quote) => (
              <div
                key={quote.id}
                className="card p-4 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-500">
                      {quote.lexware_quote_number || `#${quote.id.slice(0, 6)}`}
                    </span>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <h3 className="font-medium text-white mt-1">
                    {quote.package_title || quote.title}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">
                    {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
                  </p>
                  {quote.lexware_quotation_id && (
                    <button
                      onClick={() => window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank")}
                      className="text-xs text-[#fa432a] hover:underline mt-1"
                    >
                      PDF anzeigen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    orange: "from-orange-500/20 to-red-500/20 text-orange-400",
    blue: "from-blue-500/20 to-cyan-500/20 text-blue-400",
    yellow: "from-yellow-500/20 to-orange-500/20 text-yellow-400",
    green: "from-green-500/20 to-emerald-500/20 text-green-400",
  };

  return (
    <div className={`card p-4 bg-gradient-to-br ${colors[color]}`}>
      <Icon className="w-5 h-5 mb-2 opacity-70" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    "1. Neu": { label: "Neu", class: "bg-blue-500/20 text-blue-400" },
    "2. In Planung": { label: "In Planung", class: "bg-yellow-500/20 text-yellow-400" },
    "3. Material bestellt": { label: "Material bestellt", class: "bg-orange-500/20 text-orange-400" },
    "4. Montage geplant": { label: "Montage geplant", class: "bg-purple-500/20 text-purple-400" },
    "5. In Montage": { label: "In Montage", class: "bg-cyan-500/20 text-cyan-400" },
    "6. Abgeschlossen": { label: "Abgeschlossen", class: "bg-green-500/20 text-green-400" },
  };

  const info = statusMap[status || ""] || { label: status || "Offen", class: "bg-neutral-500/20 text-neutral-400" };

  return (
    <span className={`text-xs px-2 py-1 rounded ${info.class}`}>
      {info.label}
    </span>
  );
}

function QuoteStatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: "Entwurf", class: "bg-neutral-500/20 text-neutral-400" },
    sent: { label: "Versendet", class: "bg-yellow-500/20 text-yellow-400" },
    accepted: { label: "Angenommen", class: "bg-green-500/20 text-green-400" },
    rejected: { label: "Abgelehnt", class: "bg-red-500/20 text-red-400" },
  };

  const info = statusMap[status] || { label: status, class: "bg-neutral-500/20 text-neutral-400" };

  return (
    <span className={`text-xs px-2 py-1 rounded ${info.class}`}>
      {info.label}
    </span>
  );
}
