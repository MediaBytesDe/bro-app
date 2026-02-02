"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  FileText,
  Upload,
  Search,
  Folder,
  File,
  Image,
  FileSpreadsheet,
  Trash2,
  Download,
  ExternalLink,
  Filter,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Document, DocumentType, Project } from "@/types/database";

const documentTypeLabels: Record<DocumentType, string> = {
  vertrag: "Vertrag",
  angebot: "Angebot",
  rechnung: "Rechnung",
  aufmass: "Aufmaß",
  plan: "Plan",
  foto: "Foto",
  protokoll: "Protokoll",
  unterschrift: "Unterschrift",
  datenschutz: "Datenschutz",
  sonstiges: "Sonstiges",
};

const documentTypeIcons: Record<DocumentType, React.ReactNode> = {
  vertrag: <FileText className="w-5 h-5 text-blue-400" />,
  angebot: <FileText className="w-5 h-5 text-green-400" />,
  rechnung: <FileText className="w-5 h-5 text-yellow-400" />,
  aufmass: <FileSpreadsheet className="w-5 h-5 text-purple-400" />,
  plan: <FileSpreadsheet className="w-5 h-5 text-cyan-400" />,
  foto: <Image className="w-5 h-5 text-pink-400" />,
  protokoll: <FileText className="w-5 h-5 text-orange-400" />,
  unterschrift: <FileText className="w-5 h-5 text-red-400" />,
  datenschutz: <FileText className="w-5 h-5 text-gray-400" />,
  sonstiges: <File className="w-5 h-5 text-neutral-400" />,
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    projectId: "",
    documentType: "sonstiges" as DocumentType,
    description: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    const [docsRes, projectsRes] = await Promise.all([
      supabase
        .from("documents")
        .select("*, projects(name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, name, slug")
        .order("name"),
    ]);

    setDocuments(docsRes.data || []);
    setProjects(projectsRes.data || []);
    setLoading(false);
  }

  const filtered = documents.filter((d) => {
    const matchesSearch = !search || 
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description?.toLowerCase().includes(search.toLowerCase());
    const matchesType = !typeFilter || d.document_type === typeFilter;
    const matchesProject = !projectFilter || d.project_id === projectFilter;
    return matchesSearch && matchesType && matchesProject;
  });

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }

  async function uploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !uploadForm.projectId) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("projectId", uploadForm.projectId);
      formData.append("documentType", uploadForm.documentType);
      if (uploadForm.description) {
        formData.append("description", uploadForm.description);
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setShowUpload(false);
        setSelectedFile(null);
        setUploadForm({ projectId: "", documentType: "sonstiges", description: "" });
        await loadData();
      } else {
        alert(`Upload fehlgeschlagen: ${data.error}`);
      }
    } catch (err) {
      alert(`Upload fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id: string) {
    if (!confirm("Dokument wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        await loadData();
      } else {
        alert(`Löschen fehlgeschlagen: ${data.error}`);
      }
    } catch (err) {
      alert(`Löschen fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    }
  }

  async function openDocument(doc: Document) {
    if (doc.onedrive_url) {
      window.open(doc.onedrive_url, "_blank");
    } else {
      // Get download URL
      const res = await fetch(`/api/documents?id=${doc.id}`);
      const data = await res.json();
      if (data.document?.downloadUrl) {
        window.open(data.document.downloadUrl, "_blank");
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Folder className="w-6 h-6 text-blue-400" />
          Dokumente
          <span className="text-neutral-500 font-normal text-base ml-2">
            ({filtered.length})
          </span>
        </h1>
        <button onClick={() => setShowUpload(true)} className="btn btn-primary">
          <Upload className="w-4 h-4" />
          Hochladen
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Alle Typen</option>
          {Object.entries(documentTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Alle Projekte</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Dokumente...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-500">Keine Dokumente gefunden</p>
          <p className="text-neutral-600 text-sm mt-1">
            Lade dein erstes Dokument hoch
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[#1f1f1f]">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="list-item group"
            >
              {/* Icon */}
              <div className="shrink-0">
                {documentTypeIcons[doc.document_type] || <File className="w-5 h-5" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openDocument(doc)}>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{doc.name}</span>
                  <span className="badge badge-gray text-xs">
                    {documentTypeLabels[doc.document_type]}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
                  <span>{formatFileSize(doc.size_bytes)}</span>
                  <span>{formatDate(doc.created_at)}</span>
                  {(doc as Document & { projects?: { name: string } }).projects?.name && (
                    <span className="text-blue-400">
                      {(doc as Document & { projects?: { name: string } }).projects?.name}
                    </span>
                  )}
                </div>
                {doc.description && (
                  <p className="text-sm text-neutral-400 mt-1 truncate">{doc.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.onedrive_url && (
                  <a
                    href={doc.onedrive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0"
                    title="In OneDrive öffnen"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                  className="btn btn-ghost btn-icon !w-10 !h-10 !min-h-0 hover:!text-red-400"
                  title="Löschen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Dokument hochladen">
        <form onSubmit={uploadDocument} className="space-y-4">
          {/* File Input */}
          <div>
            <label className="form-label">Datei *</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#333] rounded-lg p-6 text-center cursor-pointer hover:border-orange-500/50 transition-colors"
            >
              {selectedFile ? (
                <div>
                  <File className="w-8 h-8 mx-auto text-orange-400 mb-2" />
                  <p className="text-white font-medium">{selectedFile.name}</p>
                  <p className="text-neutral-500 text-sm">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto text-neutral-500 mb-2" />
                  <p className="text-neutral-400">Klicken zum Auswählen</p>
                  <p className="text-neutral-600 text-sm">oder Drag & Drop</p>
                </div>
              )}
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="form-label">Projekt *</label>
            <select
              value={uploadForm.projectId}
              onChange={(e) => setUploadForm({ ...uploadForm, projectId: e.target.value })}
              className="input"
              required
            >
              <option value="">-- Projekt auswählen --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Document Type */}
          <div>
            <label className="form-label">Dokumenttyp</label>
            <select
              value={uploadForm.documentType}
              onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value as DocumentType })}
              className="input"
            >
              {Object.entries(documentTypeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Beschreibung</label>
            <input
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              className="input"
              placeholder="Optionale Beschreibung..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={uploading || !selectedFile || !uploadForm.projectId}
              className="btn btn-primary flex-1"
            >
              {uploading ? <Spinner className="!w-5 !h-5" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Lade hoch..." : "Hochladen"}
            </button>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
