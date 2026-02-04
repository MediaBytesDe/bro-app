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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

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

    setLoading(false);
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

    // Upload file
    const fileName = `invoices/${partnerUser.partner_id}/${Date.now()}_${uploadForm.file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, uploadForm.file);

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
    reviewed: { label: "In Prüfung", icon: Eye, class: "text-blue-400 bg-blue-500/20" },
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
            <FileText className="w-7 h-7 text-blue-400" />
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
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const status = statusConfig[invoice.status] || statusConfig.uploaded;
            const StatusIcon = status.icon;

            return (
              <div key={invoice.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#111] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-neutral-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">
                        {invoice.invoice_number || `Rechnung vom ${formatDate(invoice.uploaded_at)}`}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${status.class}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                      {invoice.project?.name && (
                        <span>{invoice.project.name}</span>
                      )}
                      {invoice.invoice_date && (
                        <span>Datum: {formatDate(invoice.invoice_date)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-white">{formatCurrency(invoice.amount)}</p>
                  </div>
                  <a
                    href={invoice.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-neutral-400 hover:text-blue-400 transition-colors"
                    title="Herunterladen"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                </div>
              </div>
            );
          })}
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
                      ? "border-blue-500 bg-blue-500/10" 
                      : "border-[#333] hover:border-[#444]"
                  }`}
                >
                  {uploadForm.file ? (
                    <span className="text-blue-400">{uploadForm.file.name}</span>
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
    </div>
  );
}
