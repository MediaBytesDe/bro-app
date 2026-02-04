"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { 
  ChevronLeft, Calendar, MapPin, FileText, Image as ImageIcon,
  Clock, CheckCircle, User, Download, Briefcase, X, ExternalLink,
  ChevronRight as ChevronRightIcon, Eye
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getTradeLabel, loadTradesFromDB } from "@/lib/trades";
import { ModelViewer3D } from "@/components/model-viewer-3d";

export default function CustomerProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const impersonateId = searchParams.get("impersonate");
  const isAdminPreview = searchParams.get("admin_preview") === "true" || !!impersonateId;
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "gallery">("overview");
  
  // Document/Image/Quote Preview
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewQuote, setPreviewQuote] = useState<any | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadProject();
  }, [params.slug, profile]);

  async function loadProject() {
    if (!profile?.auth_id || !params.slug) { setLoading(false); return; }

    try {
      // Trades aus DB laden (für Labels)
      await loadTradesFromDB(supabase, true);

      // Check if admin preview mode
      const isAdmin = profile.role === "admin" || profile.role === "superadmin";
      let projectData: any = null;
      
      if (isAdminPreview && isAdmin) {
        // Admin preview mode - load project directly by slug
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("slug", params.slug)
          .single();

        if (error || !data) {
          setLoading(false);
          router.push("/projects");
          return;
        }
        
        projectData = data;
      } else {
        // Normal customer mode - verify ownership
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", profile.auth_id)
          .single();

        if (!customer) {
          setLoading(false);
          router.push("/portal");
          return;
        }

        // Load project (must belong to this customer)
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("slug", params.slug)
          .eq("customer_id", customer.id)
          .single();

        if (error || !data) {
          setLoading(false);
          router.push("/portal/projekte");
          return;
        }
        
        projectData = data;
      }

      setProject(projectData);

      // Load documents
      const { data: docsData } = await supabase
        .from("documents")
        .select("*")
        .eq("project_id", projectData.id)
        .order("created_at", { ascending: false });
      setDocuments(docsData || []);

      // Load internal appointments
      const { data: internalAppts } = await supabase
        .from("appointments")
        .select("*")
        .eq("project_id", projectData.id)
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .order("scheduled_date", { ascending: true });

      // Load partner job appointments
      const { data: jobs } = await supabase
        .from("partner_jobs")
        .select("id, trade")
        .eq("project_id", projectData.id);

      let partnerAppts: any[] = [];
      if (jobs && jobs.length > 0) {
        const jobIds = jobs.map(j => j.id);
        const jobTrades = Object.fromEntries(jobs.map(j => [j.id, j.trade]));
        
        const { data: pAppts } = await supabase
          .from("partner_job_appointments")
          .select("*")
          .in("job_id", jobIds)
          .gte("date", new Date().toISOString().split("T")[0])
          .order("date", { ascending: true });

        partnerAppts = (pAppts || []).map(a => ({
          id: a.id,
          title: a.title,
          scheduled_date: a.date,
          scheduled_time: a.time_start?.slice(0, 5),
          time_end: a.time_end?.slice(0, 5),
          trade: jobTrades[a.job_id],
          _type: 'partner'
        }));
      }

      // Merge and sort
      const allAppts = [
        ...(internalAppts || []).map(a => ({ ...a, _type: 'internal' })),
        ...partnerAppts
      ].sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
       .slice(0, 5);

      setAppointments(allAppts);

      // Load quotes
      const { data: quotesData } = await supabase
        .from("wawi_quotes")
        .select("*")
        .eq("project_id", projectData.id)
        .order("created_at", { ascending: false });
      setQuotes(quotesData || []);
    } catch (err) {
      console.error("Error loading project:", err);
    } finally {
      setLoading(false);
    }
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
  const models3d = documents.filter(d => 
    d.name?.toLowerCase().endsWith(".glb") || 
    d.name?.toLowerCase().endsWith(".gltf") ||
    d.mime_type === "model/gltf-binary" ||
    d.mime_type === "model/gltf+json"
  );
  const docs = documents.filter(d => 
    !d.mime_type?.startsWith("image/") &&
    !d.name?.toLowerCase().endsWith(".glb") &&
    !d.name?.toLowerCase().endsWith(".gltf")
  );

  return (
    <div className="space-y-6">
      {/* Admin Preview Banner */}
      {isAdminPreview && (
        <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-400">
            <Eye className="w-5 h-5" />
            <span className="font-medium">Admin-Vorschau</span>
            <span className="text-blue-400/70">– So sieht der Kunde dieses Projekt</span>
          </div>
          <button
            onClick={() => window.close()}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Schließen
          </button>
        </div>
      )}

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
          <div className="w-14 h-14 rounded-xl bg-[#fa432a]/10 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-7 h-7 text-[#fa432a]" />
          </div>
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
        <div className="space-y-6">
          {/* 3D Model Viewer */}
          {models3d.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                3D-Modell Ihres Projekts
              </h3>
              <ModelViewer3D 
                src={models3d[0].storage_url} 
                alt={`3D-Modell: ${project.name}`}
                className="h-[400px] md:h-[500px]"
              />
              {models3d.length > 1 && (
                <p className="text-xs text-neutral-500 mt-2 text-center">
                  {models3d.length} 3D-Modelle verfügbar
                </p>
              )}
            </div>
          )}

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
                {appointments.map((appt) => {
                  const isPartner = appt._type === 'partner';
                  return (
                    <Link 
                      key={appt.id} 
                      href={`/portal/termine?highlight=${appt.id}`}
                      className="flex items-center gap-3 text-sm p-2 -mx-2 rounded-lg hover:bg-[#111] transition-colors group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isPartner ? "bg-[#fa432a]/20 text-[#fa432a]" : "bg-blue-500/20 text-blue-400"
                      }`}>
                        {new Date(appt.scheduled_date).getDate()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium group-hover:text-[#fa432a] transition-colors">{appt.title}</p>
                          {isPartner && appt.trade && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                              {getTradeLabel(appt.trade)}
                            </span>
                          )}
                        </div>
                        <p className="text-neutral-500">
                          {formatDate(appt.scheduled_date)}
                          {appt.scheduled_time && ` um ${appt.scheduled_time}`}
                          {appt.time_end && ` – ${appt.time_end}`}
                        </p>
                      </div>
                    </Link>
                  );
                })}
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
                          onClick={() => setPreviewQuote(quote)}
                          className="text-xs text-[#fa432a] hover:underline"
                        >
                          PDF ansehen
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Documents */}
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Dokumente
            </h3>
            {docs.length === 0 ? (
              <p className="text-neutral-500 text-sm">Keine Dokumente vorhanden</p>
            ) : (
              <div className="space-y-2">
                {docs.slice(0, 5).map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setPreviewDoc(doc)}
                    className="w-full flex items-center gap-3 text-sm p-2 -mx-2 rounded-lg hover:bg-[#111] transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate group-hover:text-[#fa432a] transition-colors">{doc.name}</p>
                      <p className="text-neutral-500 text-xs">{formatDate(doc.created_at)}</p>
                    </div>
                  </button>
                ))}
                {docs.length > 5 && (
                  <button
                    onClick={() => setActiveTab("documents")}
                    className="w-full text-center text-sm text-[#fa432a] hover:underline py-2"
                  >
                    Alle {docs.length} Dokumente anzeigen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Recent Photos */}
          {images.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-400" />
                Fotos
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {images.slice(0, 4).map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="aspect-square rounded-lg overflow-hidden bg-[#111] hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={img.storage_url}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {images.length > 4 && (
                <button
                  onClick={() => setActiveTab("gallery")}
                  className="w-full text-center text-sm text-[#fa432a] hover:underline py-2 mt-2"
                >
                  Alle {images.length} Fotos anzeigen
                </button>
              )}
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
                <button
                  key={doc.id}
                  onClick={() => setPreviewDoc(doc)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-[#111] hover:bg-[#1a1a1a] transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-neutral-500" />
                    <div>
                      <p className="text-white font-medium">{doc.name}</p>
                      <p className="text-xs text-neutral-500">{formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-neutral-500" />
                </button>
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
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setLightboxIndex(idx)}
                  className="aspect-square rounded-lg overflow-hidden bg-[#111] hover:opacity-80 transition-opacity"
                >
                  <img
                    src={img.storage_url}
                    alt={img.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document Preview Overlay */}
      {previewDoc && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPreviewDoc(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="text-white">
              <h3 className="font-medium">{previewDoc.name}</h3>
              <p className="text-sm text-neutral-400">{formatDate(previewDoc.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewDoc.storage_url}
                download={previewDoc.name}
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
                title="Herunterladen"
              >
                <Download className="w-5 h-5" />
              </a>
              <a
                href={previewDoc.storage_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
                title="In neuem Tab öffnen"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
            {previewDoc.mime_type?.startsWith("image/") ? (
              <div className="h-full flex items-center justify-center">
                <img
                  src={previewDoc.storage_url}
                  alt={previewDoc.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : previewDoc.mime_type === "application/pdf" ? (
              <iframe
                src={previewDoc.storage_url}
                className="w-full h-full rounded-lg bg-white"
                title={previewDoc.name}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                <FileText className="w-24 h-24 mb-4 opacity-50" />
                <p className="text-lg mb-2">Vorschau nicht verfügbar</p>
                <p className="text-sm mb-4">Dateityp: {previewDoc.mime_type || "Unbekannt"}</p>
                <a
                  href={previewDoc.storage_url}
                  download={previewDoc.name}
                  className="px-4 py-2 bg-[#fa432a] hover:bg-[#e03d26] text-white rounded-lg flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Herunterladen
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quote PDF Preview Overlay */}
      {previewQuote && previewQuote.lexware_quotation_id && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPreviewQuote(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="text-white">
              <h3 className="font-medium">{previewQuote.package_title || previewQuote.title}</h3>
              <p className="text-sm text-neutral-400">
                {previewQuote.lexware_quote_number || `#${previewQuote.id.slice(0, 6)}`} • {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(previewQuote.total_amount)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/lexware/quote-pdf?lexwareId=${previewQuote.lexware_quotation_id}&download=true`}
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
                title="Herunterladen"
              >
                <Download className="w-5 h-5" />
              </a>
              <a
                href={`/api/lexware/quote-pdf?lexwareId=${previewQuote.lexware_quotation_id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
                title="In neuem Tab öffnen"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                onClick={() => setPreviewQuote(null)}
                className="p-2 text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 overflow-hidden p-4" onClick={(e) => e.stopPropagation()}>
            <iframe
              src={`/api/lexware/quote-pdf?lexwareId=${previewQuote.lexware_quotation_id}`}
              className="w-full h-full rounded-lg bg-white"
              title={previewQuote.package_title || previewQuote.title}
            />
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>

          {/* Download */}
          <a
            href={images[lightboxIndex].storage_url}
            download={images[lightboxIndex].name}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-16 p-2 text-white/70 hover:text-white transition-colors"
          >
            <Download className="w-7 h-7" />
          </a>

          {/* Counter */}
          <div className="absolute top-4 left-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>

          {/* Previous */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
              className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightboxIndex].storage_url}
            alt={images[lightboxIndex].name}
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
              className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
            >
              <ChevronRightIcon className="w-10 h-10" />
            </button>
          )}

          {/* Image Info */}
          <div className="absolute bottom-4 left-0 right-0 text-center text-white">
            <p className="font-medium">{images[lightboxIndex].name}</p>
            <p className="text-sm text-white/60">{formatDate(images[lightboxIndex].created_at)}</p>
          </div>
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
