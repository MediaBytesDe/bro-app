"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { 
  FileText, 
  Plus,
  Upload,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  file_url: string;
  amount: number;
  notes: string;
  status: string;
  uploaded_at: string;
  project?: {
    name: string;
  };
}

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [partnerUser, setPartnerUser] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    amount: "",
    projectId: "",
    notes: "",
  });
  
  // Preview Modal State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

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
      
      // Only admins can see invoices
      if (pu.role !== "admin") {
        setLoading(false);
        window.location.href = "/partner";
        return;
      }
      
      setPartnerUser(pu);

      // Get invoices
      const { data: inv } = await supabase
        .from("partner_invoices")
        .select(`
          *,
          project:projects (name)
        `)
        .eq("partner_id", pu.partner_id)
        .order("uploaded_at", { ascending: false });

      setInvoices(inv || []);

      // Get projects for dropdown (from accepted jobs)
      const { data: jobs } = await supabase
        .from("partner_jobs")
        .select("project:projects (id, name)")
        .eq("accepted_by_partner_id", pu.partner_id)
        .not("project", "is", null);

      const uniqueProjects = Array.from(
        new Map(jobs?.map(j => [j.project?.id, j.project]).filter(p => p[1])).values()
      );
      setProjects(uniqueProjects);
    } catch (err) {
      console.error("Error loading invoices:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setUploadForm({ ...uploadForm, file });
    }
  }

  async function uploadInvoice() {
    if (!uploadForm.file || !partnerUser) {
      toast.error("Bitte Datei auswählen");
      return;
    }

    setUploading(true);

    // Upload file - sanitize filename (remove umlauts, special chars)
    const sanitizedName = uploadForm.file.name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace special chars
    const fileName = `invoices/${partnerUser.partner_id}/${Date.now()}_${sanitizedName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, uploadForm.file);
    
    console.log('[Upload] fileName:', fileName, 'result:', uploadData, 'error:', uploadError);

    if (uploadError) {
      toast.error("Fehler beim Hochladen");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Create invoice record
    const { error } = await supabase
      .from("partner_invoices")
      .insert({
        partner_id: partnerUser.partner_id,
        project_id: uploadForm.projectId || null,
        invoice_number: uploadForm.invoiceNumber || null,
        invoice_date: uploadForm.invoiceDate || null,
        file_url: urlData.publicUrl,
        amount: uploadForm.amount ? parseFloat(uploadForm.amount) : null,
        notes: uploadForm.notes || null,
        status: "uploaded",
      });

    if (error) {
      toast.error("Fehler beim Speichern");
    } else {
      toast.success("Rechnung hochgeladen");
      setShowUpload(false);
      setUploadForm({
        file: null,
        invoiceNumber: "",
        invoiceDate: new Date().toISOString().split("T")[0],
        amount: "",
        projectId: "",
        notes: "",
      });
      loadData();
    }

    setUploading(false);
  }

  function formatCurrency(amount: number | null) {
    if (!amount) return "–";
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
  }

  const statusConfig: Record<string, { label: string; icon: any; class: string }> = {
    uploaded: { label: "Hochgeladen", icon: Clock, class: "text-yellow-400 bg-yellow-500/20" },
    reviewed: { label: "In Prüfung", icon: Eye, class: "text-[#fa432a] bg-[#fa432a]/20" },
    approved: { label: "Freigegeben", icon: CheckCircle, class: "text-green-400 bg-green-500/20" },
    paid: { label: "Bezahlt", icon: CheckCircle, class: "text-green-400 bg-green-500/20" },
  };

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
            <FileText className="w-7 h-7 text-[#fa432a]" />
            Rechnungen
          </h1>
          <p className="text-neutral-400 mt-1">
            Ihre Rechnungen an BROjekt
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          Rechnung hochladen
        </button>
      </div>

      {/* Invoices List */}
      {invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-lg">Noch keine Rechnungen</p>
          <p className="text-neutral-500 text-sm mt-1">
            Laden Sie Ihre erste Rechnung hoch
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 bg-[#0a0a0a]">
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Status</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Rechnungsnr.</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden sm:table-cell">Datum</th>
                <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">Projekt</th>
                <th className="text-right text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Betrag</th>
                <th className="w-20 text-right text-xs text-neutral-500 uppercase py-3 px-4 font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const status = statusConfig[invoice.status] || statusConfig.uploaded;
                const StatusIcon = status.icon;

                return (
                  <tr 
                    key={invoice.id}
                    className="border-b border-neutral-800/50 hover:bg-[#111] transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${status.class}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-white">
                        {invoice.invoice_number || `#${invoice.id.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell">
                      <span className="text-neutral-300 text-sm">
                        {invoice.invoice_date ? formatDate(invoice.invoice_date) : formatDate(invoice.uploaded_at)}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="text-neutral-400 text-sm">
                        {invoice.project?.name || '–'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-white">{formatCurrency(invoice.amount)}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewUrl(invoice.file_url)}
                          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800"
                          title="Vorschau"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={invoice.file_url}
                          download
                          className="p-1.5 text-neutral-500 hover:text-white rounded hover:bg-neutral-800"
                          title="Download"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Rechnung hochladen</h2>
            
            <div className="space-y-4">
              {/* File */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">PDF-Datei *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full p-4 border-2 border-dashed rounded-lg text-center transition-colors ${
                    uploadForm.file 
                      ? "border-[#fa432a] bg-[#fa432a]/10" 
                      : "border-[#333] hover:border-[#444]"
                  }`}
                >
                  {uploadForm.file ? (
                    <span className="text-[#fa432a]">{uploadForm.file.name}</span>
                  ) : (
                    <span className="text-neutral-500">Klicken um PDF auszuwählen</span>
                  )}
                </button>
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Rechnungsnummer</label>
                <input
                  type="text"
                  value={uploadForm.invoiceNumber}
                  onChange={(e) => setUploadForm({ ...uploadForm, invoiceNumber: e.target.value })}
                  className="input w-full"
                  placeholder="RE-2026-001"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Rechnungsdatum</label>
                <input
                  type="date"
                  value={uploadForm.invoiceDate}
                  onChange={(e) => setUploadForm({ ...uploadForm, invoiceDate: e.target.value })}
                  className="input w-full"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Betrag (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={uploadForm.amount}
                  onChange={(e) => setUploadForm({ ...uploadForm, amount: e.target.value })}
                  className="input w-full"
                  placeholder="0,00"
                />
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Projekt (optional)</label>
                  <select
                    value={uploadForm.projectId}
                    onChange={(e) => setUploadForm({ ...uploadForm, projectId: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Kein Projekt zugeordnet</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Anmerkungen</label>
                <textarea
                  value={uploadForm.notes}
                  onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="Optional..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowUpload(false)}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                onClick={uploadInvoice}
                disabled={uploading || !uploadForm.file}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {uploading ? <Spinner className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                Hochladen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div 
            className="relative w-full max-w-5xl h-[90vh] bg-[#111] rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 bg-[#111]/95 backdrop-blur p-4 flex items-center justify-between z-10">
              <span className="text-white font-medium">Dokument-Vorschau</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  download
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Herunterladen
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  className="p-2 text-neutral-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            {/* PDF/Image Viewer */}
            <iframe
              src={previewUrl}
              className="w-full h-full pt-16"
              title="Dokument-Vorschau"
            />
          </div>
        </div>
      )}
    </div>
  );
}
