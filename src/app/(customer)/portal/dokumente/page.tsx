"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Folder,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Document {
  id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: string;
  status: string;
  uploaded_by: string;
  created_at: string;
  project?: {
    name: string;
  };
}

const categoryLabels: Record<string, string> = {
  contract: "Verträge",
  invoice: "Rechnungen",
  plan: "Planungsunterlagen",
  permit: "Genehmigungen",
  report: "Berichte",
  photo: "Fotos",
  other: "Sonstiges",
  customer_upload: "Ihre Uploads",
};

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pending: { label: "Wird geprüft", icon: Clock, color: "text-yellow-400" },
  approved: { label: "Freigegeben", icon: CheckCircle, color: "text-green-400" },
  rejected: { label: "Abgelehnt", icon: AlertCircle, color: "text-red-400" },
};

function getFileIcon(fileType: string) {
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.includes("spreadsheet") || fileType.includes("excel"))
    return FileSpreadsheet;
  if (fileType.includes("pdf")) return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DokumentePage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;
  
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [profile, impersonateId]);

  async function loadData() {
    if (!profile?.auth_id) { setLoading(false); return; }

    try {
      let cId: string | null = null;
      
      if (isImpersonating && impersonateId) {
        cId = impersonateId;
      } else {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", profile.auth_id)
          .single();

        if (!customer) {
          setLoading(false);
          return;
        }
        cId = customer.id;
      }

      setCustomerId(cId);

      // Load documents for customer's projects + direct uploads
      const { data: docsData } = await supabase
        .from("documents")
        .select(`
          id, name, file_url, file_type, file_size, category, status, uploaded_by, created_at,
          project:projects(name)
        `)
        .or(`customer_id.eq.${cId},project.customer_id.eq.${cId}`)
        .eq("visible_to_customer", true)
        .order("created_at", { ascending: false });

      setDocuments(docsData || []);
    } catch (err) {
      console.error("Error loading documents:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !customerId) return;

    setUploading(true);

    for (const file of Array.from(files)) {
      // Upload to storage
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `customer-uploads/${customerId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Fehler beim Hochladen: ${file.name}`);
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Create document record
      const { error: docError } = await supabase.from("documents").insert({
        customer_id: customerId,
        name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        file_size: file.size,
        category: "customer_upload",
        status: "pending",
        uploaded_by: "customer",
        visible_to_customer: true,
      });

      if (docError) {
        toast.error(`Fehler beim Speichern: ${file.name}`);
      } else {
        toast.success(`${file.name} hochgeladen`);
      }
    }

    loadData();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteDocument(doc: Document) {
    if (!confirm("Dokument wirklich löschen?")) return;

    // Only allow deleting own uploads
    if (doc.uploaded_by !== "customer") {
      toast.error("Sie können nur Ihre eigenen Uploads löschen");
      return;
    }

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (error) {
      toast.error("Fehler beim Löschen");
    } else {
      toast.success("Dokument gelöscht");
      loadData();
    }
  }

  // Group documents by category
  const docsByCategory = documents.reduce((acc, doc) => {
    const cat = doc.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  const categories = Object.keys(docsByCategory).sort((a, b) => {
    // Customer uploads first
    if (a === "customer_upload") return -1;
    if (b === "customer_upload") return 1;
    return (categoryLabels[a] || a).localeCompare(categoryLabels[b] || b);
  });

  const filteredDocs = selectedCategory
    ? docsByCategory[selectedCategory] || []
    : documents;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dokumente</h1>
          <p className="text-neutral-400 mt-1">
            Alle Dokumente zu Ihren Projekten
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary flex items-center gap-2"
          >
            {uploading ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Dokument hochladen
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        {/* Category Sidebar */}
        <div className="card p-4">
          <h2 className="font-semibold text-white mb-3 text-sm">Kategorien</h2>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                selectedCategory === null
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:bg-[#1a1a1a]"
              )}
            >
              Alle ({documents.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "text-neutral-400 hover:bg-[#1a1a1a]"
                )}
              >
                <Folder className="w-4 h-4" />
                {categoryLabels[cat] || cat}
                <span className="ml-auto text-xs opacity-60">
                  {docsByCategory[cat].length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Document List */}
        <div className="card p-6">
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-neutral-600 mb-4" />
              <p className="text-neutral-400">Keine Dokumente vorhanden</p>
              <p className="text-sm text-neutral-500 mt-2">
                Laden Sie Ihre Unterlagen hoch oder warten Sie auf Dokumente von
                BROjekt
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-800">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                    <th className="text-left py-3 px-4">Dokument</th>
                    <th className="text-left py-3 px-4 w-24">Größe</th>
                    <th className="text-left py-3 px-4 w-28">Datum</th>
                    <th className="text-left py-3 px-4 w-28">Status</th>
                    <th className="w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => {
                    const FileIcon = getFileIcon(doc.file_type);
                    const status = statusConfig[doc.status];
                    const StatusIcon = status?.icon;

                    return (
                      <tr
                        key={doc.id}
                        className="border-b border-neutral-800/50 last:border-0 hover:bg-[#111] transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <FileIcon className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-white font-medium truncate">{doc.name}</p>
                              {doc.project && (
                                <p className="text-xs text-neutral-500">{doc.project.name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-400">
                          {formatFileSize(doc.file_size)}
                        </td>
                        <td className="py-3 px-4 text-sm text-neutral-400">
                          {new Date(doc.created_at).toLocaleDateString("de-DE")}
                        </td>
                        <td className="py-3 px-4">
                          {doc.uploaded_by === "customer" && status ? (
                            <span className={cn("flex items-center gap-1 text-xs", status.color)}>
                              <StatusIcon className="w-3 h-3" />
                              {status.label}
                            </span>
                          ) : (
                            <span className="text-xs text-green-400">Freigegeben</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                              title="Ansehen"
                            >
                              <Eye className="w-4 h-4 text-neutral-400" />
                            </a>
                            <a
                              href={doc.file_url}
                              download={doc.name}
                              className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                              title="Herunterladen"
                            >
                              <Download className="w-4 h-4 text-neutral-400" />
                            </a>
                            {doc.uploaded_by === "customer" && (
                              <button
                                onClick={() => deleteDocument(doc)}
                                className="p-1.5 hover:bg-[#1a1a1a] rounded transition-colors"
                                title="Löschen"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
