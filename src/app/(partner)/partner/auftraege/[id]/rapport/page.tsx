"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import Image from "next/image";
import SignatureCanvas from "react-signature-canvas";
import { 
  ArrowLeft,
  Camera,
  X,
  PenTool,
  CheckCircle,
  Plus,
  RotateCcw,
  BookOpen,
  Calendar,
  Trash2,
  Edit
} from "lucide-react";
import { toast } from "sonner";

interface DiaryEntry {
  id: string;
  entry_date: string;
  text: string;
  photos: { url: string; caption: string }[];
  created_at: string;
  partner_user?: {
    display_name: string;
  };
}

export default function RapportPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState<any>(null);
  const [partnerUser, setPartnerUser] = useState<any>(null);

  // Tagebuch-Einträge
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    date: new Date().toISOString().split('T')[0],
    text: '',
    photos: [] as { url: string; caption: string }[]
  });

  // Abschluss-Rapport
  const [showFinalize, setShowFinalize] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [finalReport, setFinalReport] = useState<any>(null);

  const signatureRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: pu } = await supabase
        .from("partner_users")
        .select("*, partner:partners(*)")
        .eq("auth_user_id", user.id)
        .single();

      if (!pu) { setLoading(false); return; }
      setPartnerUser(pu);

      const { data: jobData } = await supabase
        .from("partner_jobs")
        .select(`
          *,
          project:projects (
            name,
            customer:customers (first_name, last_name)
          )
        `)
        .eq("id", jobId)
        .single();

      if (!jobData) {
        setLoading(false);
        router.push(`/partner/auftraege/${jobId}`);
        return;
      }

      setJob(jobData);
      const customerFullName = jobData.project?.customer 
        ? `${jobData.project.customer.first_name} ${jobData.project.customer.last_name}`
        : "";
      setCustomerName(customerFullName);

      // Tagebuch-Einträge laden
      const { data: diaryEntries } = await supabase
        .from("job_diary_entries")
        .select(`
          *,
          partner_user:partner_users (display_name)
        `)
        .eq("job_id", jobId)
        .order("entry_date", { ascending: false });

      setEntries(diaryEntries || []);

      // Existierenden Abschluss-Rapport laden
      const { data: existingReport } = await supabase
        .from("job_reports")
        .select("*")
        .eq("job_id", jobId)
        .single();

      if (existingReport) {
        setFinalReport(existingReport);
        setSignatureData(existingReport.customer_signature_url);
        setCustomerName(existingReport.customer_name || customerFullName);
      }
    } catch (err) {
      console.error("Error loading rapport:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      const sanitizedName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `diary/${jobId}/${Date.now()}_${sanitizedName}`;
      
      const { error } = await supabase.storage
        .from("documents")
        .upload(fileName, file, { contentType: file.type });

      if (error) {
        toast.error(`Fehler: ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      setEntryForm(prev => ({
        ...prev,
        photos: [...prev.photos, { url: urlData.publicUrl, caption: "" }]
      }));
    }

    toast.success("Fotos hochgeladen");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setEntryForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  }

  function startNewEntry() {
    setEditingEntry(null);
    setEntryForm({
      date: new Date().toISOString().split('T')[0],
      text: '',
      photos: []
    });
    setShowEntryForm(true);
  }

  function startEditEntry(entry: DiaryEntry) {
    setEditingEntry(entry.id);
    setEntryForm({
      date: entry.entry_date,
      text: entry.text || '',
      photos: entry.photos || []
    });
    setShowEntryForm(true);
  }

  async function saveEntry() {
    if (!entryForm.text.trim() && entryForm.photos.length === 0) {
      toast.error("Bitte Text oder Fotos hinzufügen");
      return;
    }

    setSubmitting(true);

    if (editingEntry) {
      const { error } = await supabase
        .from("job_diary_entries")
        .update({
          entry_date: entryForm.date,
          text: entryForm.text,
          photos: entryForm.photos,
        })
        .eq("id", editingEntry);

      if (error) {
        toast.error("Fehler beim Speichern");
      } else {
        toast.success("Eintrag aktualisiert");
      }
    } else {
      const { error } = await supabase
        .from("job_diary_entries")
        .insert({
          job_id: jobId,
          partner_user_id: partnerUser.id,
          entry_date: entryForm.date,
          text: entryForm.text,
          photos: entryForm.photos,
        });

      if (error) {
        toast.error("Fehler beim Speichern");
      } else {
        toast.success("Eintrag hinzugefügt");
      }
    }

    setShowEntryForm(false);
    setSubmitting(false);
    loadData();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Eintrag wirklich löschen?")) return;

    const { error } = await supabase
      .from("job_diary_entries")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Eintrag gelöscht");
      loadData();
    }
  }

  function clearSignature() {
    signatureRef.current?.clear();
    setSignatureData(null);
  }

  async function saveSignature() {
    if (!signatureRef.current?.isEmpty()) {
      const dataUrl = signatureRef.current.toDataURL("image/png");
      
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

  async function finalizeReport() {
    if (!signatureData) {
      toast.error("Bitte Kundenunterschrift einholen");
      return;
    }

    if (!customerName.trim()) {
      toast.error("Bitte Kundennamen eingeben");
      return;
    }

    setSubmitting(true);

    // Alle Tagebuch-Einträge als Text zusammenfassen
    const workDone = entries
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
      .map(e => `${new Date(e.entry_date).toLocaleDateString('de-DE')}: ${e.text}`)
      .join('\n\n');

    // Alle Fotos sammeln
    const allPhotos = entries.flatMap(e => e.photos || []);

    const { error: reportError } = await supabase
      .from("job_reports")
      .upsert({
        job_id: jobId,
        partner_user_id: partnerUser.id,
        work_done: workDone,
        photos: allPhotos,
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
      toast.success("Auftrag abgeschlossen!");
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

  const isCompleted = job.status === 'completed';

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link 
        href={`/partner/auftraege/${jobId}`}
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Auftrag
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-[#fa432a]" />
            Tagebuch
          </h1>
          <p className="text-neutral-400 mt-1">{job.title} · {job.project?.name}</p>
        </div>
        {!isCompleted && (
          <button
            onClick={startNewEntry}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Eintrag hinzufügen
          </button>
        )}
      </div>

      {/* Completed Banner */}
      {isCompleted && finalReport && (
        <div className="card p-4 bg-green-500/10 border-green-500/30">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Auftrag abgeschlossen</p>
              <p className="text-sm text-neutral-400">
                Unterschrieben von {finalReport.customer_name} am {new Date(finalReport.signed_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Entry Form */}
      {showEntryForm && (
        <div className="card p-5">
          <h2 className="font-semibold text-white mb-4">
            {editingEntry ? "Eintrag bearbeiten" : "Neuer Eintrag"}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Datum</label>
              <input
                type="date"
                value={entryForm.date}
                onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                className="input w-full max-w-xs"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-1">Was wurde gemacht?</label>
              <textarea
                value={entryForm.text}
                onChange={(e) => setEntryForm({ ...entryForm, text: e.target.value })}
                rows={4}
                className="input w-full"
                placeholder="Beschreiben Sie die durchgeführten Arbeiten, Besonderheiten, Material..."
              />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">Fotos</label>
              
              {entryForm.photos.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2 mb-3">
                  {entryForm.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-[#111]">
                      <Image
                        src={photo.url}
                        alt={photo.caption || "Rapport Foto"}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80"
                      >
                        <X className="w-3 h-3" />
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
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Fotos hinzufügen
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowEntryForm(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button
                onClick={saveEntry}
                disabled={submitting}
                className="btn-primary flex items-center gap-2"
              >
                {submitting && <Spinner className="w-4 h-4" />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries List */}
      {entries.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Einträge</p>
          <p className="text-neutral-500 text-sm mt-1">
            Dokumentieren Sie Ihre Arbeit mit Tagebuch-Einträgen
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#fa432a]/20 text-[#fa432a] flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {new Date(entry.entry_date).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                    {entry.partner_user && (
                      <p className="text-xs text-neutral-500">{entry.partner_user.display_name}</p>
                    )}
                  </div>
                </div>
                {!isCompleted && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEditEntry(entry)}
                      className="p-2 text-neutral-500 hover:text-white rounded hover:bg-neutral-800"
                      title="Bearbeiten"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="p-2 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-800"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {entry.text && (
                <p className="text-neutral-300 whitespace-pre-wrap mb-3">{entry.text}</p>
              )}

              {entry.photos && entry.photos.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                  {entry.photos.map((photo, index) => (
                    <a
                      key={index}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-lg overflow-hidden bg-[#111] hover:opacity-80 transition-opacity"
                    >
                      <Image
                        src={photo.url}
                        alt={photo.caption || "Rapport Foto"}
                        width={400}
                        height={400}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Finalize Section */}
      {!isCompleted && (
        <div className="card p-5 border-[#fa432a]/30">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-[#fa432a]" />
            Kundenunterschrift & Abschluss
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-1">Name des Kunden</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="input w-full max-w-md"
                placeholder="Vor- und Nachname"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-2">Unterschrift</label>
              {signatureData ? (
                <div className="border border-[#333] rounded-lg p-4 bg-white max-w-md">
                  <Image
                    src={signatureData}
                    alt="Unterschrift"
                    width={400}
                    height={128}
                    className="max-h-32 mx-auto"
                    loading="lazy"
                  />
                  <button
                    onClick={() => setSignatureData(null)}
                    className="mt-3 text-sm text-red-400 hover:text-red-300 flex items-center gap-1 mx-auto"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Neu unterschreiben
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSignature(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <PenTool className="w-5 h-5" />
                  Unterschrift einholen
                </button>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={finalizeReport}
                disabled={submitting || !signatureData || !customerName.trim()}
                className="btn-primary flex items-center gap-2"
              >
                {submitting ? <Spinner className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                Auftrag abschließen
              </button>
              {(!signatureData || !customerName.trim()) && (
                <p className="text-xs text-neutral-500 mt-2">
                  Kundenname und Unterschrift erforderlich
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
