"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import SignatureCanvas from "react-signature-canvas";
import { 
  ArrowLeft,
  Camera,
  X,
  PenTool,
  CheckCircle,
  Upload,
  RotateCcw
} from "lucide-react";
import { toast } from "sonner";

export default function RapportPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [partnerUser, setPartnerUser] = useState<any>(null);

  // Form state
  const [reportText, setReportText] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [issues, setIssues] = useState("");
  const [photos, setPhotos] = useState<{ url: string; caption: string }[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const signatureRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: pu } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!pu) return;
    setPartnerUser(pu);

    const { data: jobData } = await supabase
      .from("partner_jobs")
      .select(`
        *,
        project:projects (
          name,
          customer:customers (name)
        )
      `)
      .eq("id", jobId)
      .single();

    if (!jobData || jobData.status !== "in_progress") {
      router.push(`/partner/auftraege/${jobId}`);
      return;
    }

    setJob(jobData);
    setCustomerName(jobData.project?.customer?.name || "");

    // Load existing draft
    const { data: existingReport } = await supabase
      .from("job_reports")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "draft")
      .single();

    if (existingReport) {
      setReportText(existingReport.report_text || "");
      setWorkDone(existingReport.work_done || "");
      setIssues(existingReport.issues || "");
      setPhotos(existingReport.photos || []);
      if (existingReport.customer_signature_url) {
        setSignatureData(existingReport.customer_signature_url);
      }
      setCustomerName(existingReport.customer_name || jobData.project?.customer?.name || "");
    }

    setLoading(false);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      // Compress and upload
      const fileName = `reports/${jobId}/${Date.now()}_${file.name}`;
      
      const { data, error } = await supabase.storage
        .from("documents")
        .upload(fileName, file, { contentType: file.type });

      if (error) {
        toast.error(`Fehler beim Hochladen: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      setPhotos(prev => [...prev, { url: urlData.publicUrl, caption: "" }]);
    }

    toast.success("Fotos hochgeladen");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  function clearSignature() {
    signatureRef.current?.clear();
    setSignatureData(null);
  }

  async function saveSignature() {
    if (!signatureRef.current?.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL("image/png");
      
      // Upload to storage
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const fileName = `reports/${jobId}/signature_${Date.now()}.png`;

      const { error } = await supabase.storage
        .from("documents")
        .upload(fileName, blob, { contentType: "image/png" });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);
        
        setSignatureData(urlData.publicUrl);
        toast.success("Unterschrift gespeichert");
      }
    }
    setShowSignature(false);
  }

  async function saveDraft() {
    if (!partnerUser) return;

    const reportData = {
      job_id: jobId,
      partner_user_id: partnerUser.id,
      report_text: reportText,
      work_done: workDone,
      issues: issues,
      photos: photos,
      customer_name: customerName,
      customer_signature_url: signatureData,
      status: "draft",
    };

    // Upsert
    const { error } = await supabase
      .from("job_reports")
      .upsert(reportData, { 
        onConflict: "job_id,partner_user_id",
        ignoreDuplicates: false 
      });

    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Entwurf gespeichert");
    }
  }

  async function submitReport() {
    if (!signatureData) {
      toast.error("Bitte Kundenunterschrift einholen");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Bitte Kundennamen eingeben");
      return;
    }

    setSubmitting(true);

    // Save report
    const { error: reportError } = await supabase
      .from("job_reports")
      .upsert({
        job_id: jobId,
        partner_user_id: partnerUser.id,
        report_text: reportText,
        work_done: workDone,
        issues: issues,
        photos: photos,
        customer_name: customerName,
        customer_signature_url: signatureData,
        signed_at: new Date().toISOString(),
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }, { onConflict: "job_id,partner_user_id" });

    if (reportError) {
      toast.error("Fehler beim Absenden");
      setSubmitting(false);
      return;
    }

    // Update job status
    const { error: jobError } = await supabase
      .from("partner_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (jobError) {
      toast.error("Fehler beim Abschließen");
    } else {
      toast.success("Rapport abgeschlossen!");
      router.push("/partner/auftraege");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back */}
      <Link 
        href={`/partner/auftraege/${jobId}`}
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Auftrag
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Rapport</h1>
        <p className="text-neutral-400 mt-1">{job.title} · {job.project?.name}</p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Work Done */}
        <div className="card p-5">
          <label className="block text-sm font-medium text-white mb-2">
            Durchgeführte Arbeiten
          </label>
          <textarea
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            rows={4}
            className="input w-full"
            placeholder="Beschreiben Sie die durchgeführten Arbeiten..."
          />
        </div>

        {/* Issues */}
        <div className="card p-5">
          <label className="block text-sm font-medium text-white mb-2">
            Besonderheiten / Probleme (optional)
          </label>
          <textarea
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            rows={3}
            className="input w-full"
            placeholder="Gab es Probleme oder Besonderheiten?"
          />
        </div>

        {/* Additional Notes */}
        <div className="card p-5">
          <label className="block text-sm font-medium text-white mb-2">
            Zusätzliche Notizen (optional)
          </label>
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            rows={3}
            className="input w-full"
            placeholder="Weitere Anmerkungen..."
          />
        </div>

        {/* Photos */}
        <div className="card p-5">
          <label className="block text-sm font-medium text-white mb-3">
            Fotos
          </label>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-[#111]">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Fotos hinzufügen
          </button>
        </div>

        {/* Signature */}
        <div className="card p-5">
          <label className="block text-sm font-medium text-white mb-3">
            Kundenunterschrift
          </label>

          <div className="mb-4">
            <label className="block text-xs text-neutral-500 mb-1">Name des Kunden</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input w-full"
              placeholder="Vor- und Nachname"
            />
          </div>

          {signatureData ? (
            <div className="border border-[#333] rounded-lg p-4 bg-white">
              <img src={signatureData} alt="Unterschrift" className="max-h-32 mx-auto" />
              <button
                onClick={() => setSignatureData(null)}
                className="mt-3 text-sm text-red-400 hover:text-red-300 flex items-center gap-1 mx-auto"
              >
                <RotateCcw className="w-4 h-4" />
                Unterschrift löschen
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSignature(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <PenTool className="w-5 h-5" />
              Unterschrift einholen
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={saveDraft}
            className="btn-secondary flex-1"
          >
            Entwurf speichern
          </button>
          <button
            onClick={submitReport}
            disabled={submitting || !signatureData}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Abschließen
              </>
            )}
          </button>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignature && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-[#333]">
            <h2 className="text-lg font-semibold text-white">Kundenunterschrift</h2>
            <button
              onClick={() => setShowSignature(false)}
              className="p-2 text-neutral-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <p className="text-neutral-400 text-center mb-4">
                Bitte hier unterschreiben:
              </p>
              <div className="bg-white rounded-xl overflow-hidden">
                <SignatureCanvas
                  ref={signatureRef}
                  canvasProps={{
                    className: "w-full h-64 touch-none",
                    style: { width: "100%", height: "256px" }
                  }}
                  penColor="black"
                  backgroundColor="white"
                />
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={clearSignature}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Löschen
                </button>
                <button
                  onClick={saveSignature}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Übernehmen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
