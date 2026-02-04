"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { 
  ChevronLeft, Calendar, MapPin, FileText, Image as ImageIcon,
  Clock, CheckCircle, User, Download
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CustomerProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "gallery">("overview");

  const supabase = createClient();

  useEffect(() => {
    loadProject();
  }, [params.slug, profile]);

  async function loadProject() {
    if (!profile?.auth_id || !params.slug) return;

    // Find customer by auth_user_id
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", profile.auth_id)
      .single();

    if (!customer) {
      router.push("/portal");
      return;
    }

    // Load project (must belong to this customer)
    const { data: projectData, error } = await supabase
      .from("projects")
      .select("*")
      .eq("slug", params.slug)
      .eq("customer_id", customer.id)
      .single();

    if (error || !projectData) {
      router.push("/portal/projekte");
      return;
    }

    setProject(projectData);

    // Load documents
    const { data: docsData } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", projectData.id)
      .order("created_at", { ascending: false });
    setDocuments(docsData || []);

    // Load appointments
    const { data: apptData } = await supabase
      .from("appointments")
      .select("*")
      .eq("project_id", projectData.id)
      .gte("scheduled_date", new Date().toISOString().split("T")[0])
      .order("scheduled_date", { ascending: true })
      .limit(5);
    setAppointments(apptData || []);

    // Load quotes
    const { data: quotesData } = await supabase
      .from("wawi_quotes")
      .select("*")
      .eq("project_id", projectData.id)
      .order("created_at", { ascending: false });
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

  if (!project) {
    return null;
  }

  const images = documents.filter(d => d.mime_type?.startsWith("image/"));
  const docs = documents.filter(d => !d.mime_type?.startsWith("image/"));

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/portal/projekte"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Zurück zu meinen Projekten
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{project.icon || "📁"}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <StatusBadge status={project.workfolder_status} />
            </div>
            
            {project.description && (
              <p className="text-neutral-400 mb-4">{project.description}</p>
            )}
            
            <div className="flex flex-wrap gap-4 text-sm text-neutral-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Erstellt: {formatDate(project.created_at)}
              </span>
              {(project.address_street || project.address_city) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {[project.address_street, project.address_postal_code, project.address_city].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1a1a1a]">
        <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
          Übersicht
        </TabButton>
        <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>
          Dokumente ({docs.length})
        </TabButton>
        <TabButton active={activeTab === "gallery"} onClick={() => setActiveTab("gallery")}>
          Fotos ({images.length})
        </TabButton>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Nächste Termine
            </h3>
            {appointments.length === 0 ? (
              <p className="text-neutral-500 text-sm">Keine anstehenden Termine</p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div key={appt.id} className="flex items-center gap-3 text-sm">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                      {new Date(appt.scheduled_date).getDate()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{appt.title}</p>
                      <p className="text-neutral-500">
                        {formatDate(appt.scheduled_date)}
                        {appt.scheduled_time && ` um ${appt.scheduled_time}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quotes */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Angebote
            </h3>
            {quotes.length === 0 ? (
              <p className="text-neutral-500 text-sm">Noch keine Angebote</p>
            ) : (
              <div className="space-y-3">
                {quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-white font-medium">
                        {quote.package_title || quote.title}
                      </p>
                      <p className="text-neutral-500">
                        {quote.lexware_quote_number || `#${quote.id.slice(0, 6)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
                      </p>
                      {quote.lexware_quotation_id && (
                        <button
                          onClick={() => window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank")}
                          className="text-xs text-[#fa432a] hover:underline"
                        >
                          PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="card p-5">
          {docs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
              <p className="text-neutral-500">Keine Dokumente vorhanden</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-neutral-500" />
                    <div>
                      <p className="text-white font-medium">{doc.name}</p>
                      <p className="text-xs text-neutral-500">{formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-neutral-500" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "gallery" && (
        <div className="card p-5">
          {images.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 mx-auto text-neutral-600 mb-3" />
              <p className="text-neutral-500">Keine Fotos vorhanden</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <a
                  key={img.id}
                  href={img.storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden bg-[#111] hover:opacity-80 transition-opacity"
                >
                  <img
                    src={img.storage_url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
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

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "text-white border-[#fa432a]"
          : "text-neutral-400 border-transparent hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
