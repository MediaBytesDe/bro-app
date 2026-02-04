"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import {
  ArrowLeft,
  User,
  Calendar,
  Users,
  FileText,
  ImageIcon,
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Eye,
  ExternalLink,
  FileSignature,
  Receipt,
  Ruler,
  ClipboardList,
  Camera,
  FileCheck,
  Shield,
  Folder,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { 
  Project, 
  Customer, 
  Appointment, 
  Subcontractor, 
  Document,
  AppointmentType,
  AppointmentStatus,
  WorkfolderStatusDef 
} from "@/types/database";

// Farben für Status
const statusColors: Record<string, string> = {
  gray: "bg-neutral-600 text-neutral-200",
  blue: "bg-blue-600 text-blue-100",
  cyan: "bg-cyan-600 text-cyan-100",
  yellow: "bg-yellow-600 text-yellow-100",
  orange: "bg-orange-600 text-orange-100",
  purple: "bg-purple-600 text-purple-100",
  green: "bg-green-600 text-green-100",
  neutral: "bg-neutral-700 text-neutral-300",
  red: "bg-red-600 text-red-100",
};

const appointmentTypeLabels: Record<AppointmentType, string> = {
  aufmass: "Aufmaß",
  vob_termin: "VOB-Termin",
  montage_start: "Montage Start",
  montage_end: "Montage Ende",
  abnahme: "Abnahme",
  nachbesserung: "Nachbesserung",
  wartung: "Wartung",
  beratung: "Beratung",
  sonstiges: "Sonstiges",
};

const appointmentStatusColors: Record<AppointmentStatus, string> = {
  scheduled: "badge-info",
  confirmed: "badge-primary",
  in_progress: "badge-warning",
  completed: "badge-success",
  cancelled: "badge-error",
  rescheduled: "badge-gray",
};

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Geplant",
  confirmed: "Bestätigt",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
  rescheduled: "Verschoben",
};

interface Props {
  project: Project;
}

type TabType = "overview" | "appointments" | "subcontractors" | "documents" | "gallery" | "forms" | "quotes" | "tasks";

export function WorkfolderDetail({ project }: Props) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabType) || "overview";
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [parentProject, setParentProject] = useState<Project | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [assignedSubs, setAssignedSubs] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allSubcontractors, setAllSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [currentStatus, setCurrentStatus] = useState<string | null>(project.workfolder_status);
  const [statusOptions, setStatusOptions] = useState<WorkfolderStatusDef[]>([]);
  
  // Modals
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [showSubcontractorModal, setShowSubcontractorModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Lightbox / Document Preview
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  
  // Document delete
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: string; name: string; storagePath: string | null } | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);
  
  // Customer change
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(project.customer_id || "");
  const [customerSearch, setCustomerSearch] = useState("");

  // Form templates & submissions
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [viewingSubmission, setViewingSubmission] = useState<any | null>(null);

  // Appointment Forms
  const [appointmentForm, setAppointmentForm] = useState({
    title: "",
    appointment_type: "aufmass" as AppointmentType,
    start_time: "",
    end_time: "",
    description: "",
    location_address: "",
    subcontractor_ids: [] as string[],
  });

  const [selectedSubId, setSelectedSubId] = useState("");

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [project.id]);

  async function loadData() {
    setLoading(true);

    // Load customer
    if (project.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("*")
        .eq("id", project.customer_id)
        .single();
      setCustomer(cust);
    }

    // Load parent project (Marke) and status options
    if (project.parent_id) {
      const { data: parent } = await supabase
        .from("projects")
        .select("*")
        .eq("id", project.parent_id)
        .single();
      setParentProject(parent);
      if (parent?.workfolder_statuses) {
        setStatusOptions(parent.workfolder_statuses as WorkfolderStatusDef[]);
      }
    }

    // Load appointments
    const { data: appts } = await supabase
      .from("appointments")
      .select("*")
      .eq("project_id", project.id)
      .order("start_time", { ascending: true });
    setAppointments(appts || []);

    // Load assigned subcontractors
    const { data: subs } = await supabase
      .from("project_subcontractors")
      .select("*, subcontractor:subcontractors(*)")
      .eq("project_id", project.id);
    setAssignedSubs(subs || []);

    // Load documents
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setDocuments(docs || []);

    // Load quotes
    const { data: quotesData } = await supabase
      .from("wawi_quotes")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setQuotes(quotesData || []);

    // Load tasks
    const { data: tasksData } = await supabase
      .from("project_tasks")
      .select("*, assigned_user:users(id, display_name), assigned_sub:subcontractors(id, company_name)")
      .eq("project_id", project.id)
      .order("sort_order")
      .order("created_at", { ascending: false });
    setTasks(tasksData || []);

    // Load all users for task assignment
    const { data: usersData } = await supabase
      .from("users")
      .select("id, display_name, username")
      .eq("active", true)
      .order("display_name");
    setAllUsers(usersData || []);

    // Load all subcontractors for assignment
    const { data: allSubs } = await supabase
      .from("subcontractors")
      .select("*")
      .eq("status", "active")
      .order("company_name");
    setAllSubcontractors(allSubs || []);

    // Load form templates (filtered by brand if parent exists)
    const templatesQuery = supabase
      .from("form_templates")
      .select("*")
      .or("is_active.is.null,is_active.eq.true")
      .order("name");
    const { data: templates } = await templatesQuery;
    // Filter by brand_ids if applicable
    const filteredTemplates = (templates || []).filter(t => {
      if (!t.brand_ids || t.brand_ids.length === 0) return true;
      return project.parent_id && t.brand_ids.includes(project.parent_id);
    });
    setFormTemplates(filteredTemplates);

    // Load form submissions for this project
    const { data: submissions } = await supabase
      .from("form_submissions")
      .select("*, form_template:form_templates(name)")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setFormSubmissions(submissions || []);

    setLoading(false);
  }

  async function updateStatus(newStatus: string) {
    const { error } = await supabase
      .from("projects")
      .update({ workfolder_status: newStatus })
      .eq("id", project.id);
    
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    setCurrentStatus(newStatus);
  }

  async function openCustomerModal() {
    // Load all customers
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("status", "active")
      .order("last_name");
    setAllCustomers(data || []);
    setSelectedCustomerId(project.customer_id || "");
    setCustomerSearch("");
    setShowCustomerModal(true);
  }

  async function updateCustomer() {
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({ customer_id: selectedCustomerId || null })
      .eq("id", project.id);
    
    if (error) {
      alert("Fehler: " + error.message);
      setSaving(false);
      return;
    }
    
    setShowCustomerModal(false);
    setSaving(false);
    loadData();
  }

  function getStatusDef(key: string | null): WorkfolderStatusDef | undefined {
    return statusOptions.find(s => s.key === key);
  }

  function openNewAppointment() {
    setEditingAppointment(null);
    setAppointmentForm({
      title: "",
      appointment_type: "aufmass",
      start_time: "",
      end_time: "",
      description: "",
      location_address: "",
      subcontractor_ids: [],
    });
    setShowAppointmentModal(true);
  }

  function openEditAppointment(apt: Appointment) {
    setEditingAppointment(apt);
    setAppointmentForm({
      title: apt.title,
      appointment_type: apt.appointment_type,
      start_time: apt.start_time ? new Date(apt.start_time).toISOString().slice(0, 16) : "",
      end_time: apt.end_time ? new Date(apt.end_time).toISOString().slice(0, 16) : "",
      description: apt.description || "",
      location_address: apt.location_address || "",
      subcontractor_ids: apt.subcontractor_ids || [],
    });
    setShowAppointmentModal(true);
  }

  async function saveAppointment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      project_id: project.id,
      customer_id: project.customer_id,
      title: appointmentForm.title,
      appointment_type: appointmentForm.appointment_type,
      start_time: appointmentForm.start_time,
      end_time: appointmentForm.end_time || null,
      description: appointmentForm.description || null,
      location_address: appointmentForm.location_address || null,
      subcontractor_ids: appointmentForm.subcontractor_ids,
    };

    let error;
    if (editingAppointment) {
      ({ error } = await supabase.from("appointments").update(payload).eq("id", editingAppointment.id));
    } else {
      ({ error } = await supabase.from("appointments").insert({ ...payload, status: "scheduled" }));
    }

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowAppointmentModal(false);
    setEditingAppointment(null);
    loadData();
  }

  async function updateAppointmentStatus(aptId: string, newStatus: AppointmentStatus) {
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", aptId);
    
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    loadData();
  }

  async function deleteAppointment(aptId: string) {
    if (!confirm("Termin wirklich löschen?")) return;
    
    const { error } = await supabase.from("appointments").delete().eq("id", aptId);
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    loadData();
  }

  async function assignSubcontractor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSubId) return;
    
    setSaving(true);
    
    const sub = allSubcontractors.find(s => s.id === selectedSubId);
    
    const { error } = await supabase.from("project_subcontractors").insert({
      project_id: project.id,
      subcontractor_id: selectedSubId,
      trade: sub?.trade || "sonstige",
      status: "assigned",
    });

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowSubcontractorModal(false);
    setSelectedSubId("");
    loadData();
  }

  async function removeSubcontractor(assignmentId: string) {
    if (!confirm("Subunternehmer wirklich entfernen?")) return;
    await supabase.from("project_subcontractors").delete().eq("id", assignmentId);
    loadData();
  }

  // Form functions
  function openFormFill(template: any) {
    setSelectedTemplate(template);
    setFormData({});
    setShowFormModal(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from("form_submissions").insert({
      form_template_id: selectedTemplate.id,
      project_id: project.id,
      customer_id: project.customer_id,
      submitted_by: user?.id,
      data: formData,
      status: "submitted",
    });

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowFormModal(false);
    setSelectedTemplate(null);
    setFormData({});
    loadData();
  }

  async function deleteSubmission(id: string) {
    if (!confirm("Ausgefülltes Formular wirklich löschen?")) return;
    await supabase.from("form_submissions").delete().eq("id", id);
    loadData();
  }

  async function uploadDocument(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const nameInput = form.querySelector('input[name="docName"]') as HTMLInputElement;
    const typeSelect = form.querySelector('select[name="docType"]') as HTMLSelectElement;
    
    if (!fileInput?.files?.length) {
      alert("Bitte eine Datei auswählen");
      return;
    }

    const file = fileInput.files[0];
    const docName = nameInput?.value || file.name;
    const docType = typeSelect?.value || "sonstiges";

    setUploading(true);

    // Upload via API route
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", project.id);
    formData.append("customerId", project.customer_id || "");
    formData.append("name", docName);
    formData.append("type", docType);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload fehlgeschlagen");
      }

      setShowDocumentModal(false);
      loadData();
    } catch (error) {
      alert("Upload-Fehler: " + (error instanceof Error ? error.message : "Unbekannter Fehler"));
    } finally {
      setUploading(false);
    }
  }

  async function confirmDeleteDocument() {
    if (!deleteDocTarget) return;
    setDeletingDoc(true);
    
    try {
      // Delete from storage
      if (deleteDocTarget.storagePath) {
        await supabase.storage.from("documents").remove([deleteDocTarget.storagePath]);
      }
      
      // Delete from DB
      await supabase.from("documents").delete().eq("id", deleteDocTarget.id);
      loadData();
    } finally {
      setDeletingDoc(false);
      setDeleteDocTarget(null);
    }
  }

  function getCustomerAddress() {
    if (!customer) return null;
    const parts = [customer.street, customer.postal_code, customer.city].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Übersicht", icon: FileText },
    { id: "quotes", label: "Angebote", icon: FileSignature, count: quotes.length },
    { id: "tasks", label: "Aufgaben", icon: ListTodo, count: tasks.filter(t => t.status !== "done").length },
    { id: "appointments", label: "Termine", icon: Calendar, count: appointments.length },
    { id: "subcontractors", label: "Subunternehmer", icon: Users, count: assignedSubs.length },
    { id: "documents", label: "Dokumente", icon: FileText, count: documents.length },
    { id: "gallery", label: "Galerie", icon: ImageIcon },
    { id: "forms", label: "Formulare", icon: ClipboardList, count: formSubmissions.length },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            {parentProject && <span>{parentProject.name}</span>}
            {parentProject && <span>/</span>}
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{project.name}</h1>
            {/* Status Dropdown */}
            {statusOptions.length > 0 && (
              <select
                value={currentStatus || ""}
                onChange={(e) => updateStatus(e.target.value)}
                className={`px-3 py-1 text-sm font-medium rounded-full border-0 cursor-pointer ${
                  getStatusDef(currentStatus)
                    ? statusColors[getStatusDef(currentStatus)!.color] || "bg-neutral-700 text-neutral-300"
                    : "bg-neutral-700 text-neutral-300"
                }`}
              >
                {statusOptions.sort((a, b) => a.sort - b.sort).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Customer Card */}
      {customer ? (
        <div className="card p-4 border-l-4 border-l-orange-500">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-neutral-400 mb-1">
                <User className="w-4 h-4" />
                Kunde
                <button
                  onClick={openCustomerModal}
                  className="text-orange-400 hover:text-orange-300 ml-1"
                  title="Kunde ändern"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <h3 className="font-semibold text-white">
                {customer.company_name || `${customer.first_name} ${customer.last_name}`}
              </h3>
              {getCustomerAddress() && (
                <p className="text-sm text-neutral-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {getCustomerAddress()}
                </p>
              )}
              {(customer.phone || customer.mobile) && (
                <a 
                  href={`tel:${customer.mobile || customer.phone}`} 
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {customer.mobile || customer.phone}
                </a>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white">
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </a>
              )}
              {customer.mobile && customer.mobile !== customer.phone && (
                <a href={`tel:${customer.mobile}`} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white">
                  <Phone className="w-3 h-3" />
                  {customer.mobile}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white">
                  <Mail className="w-3 h-3" />
                  {customer.email}
                </a>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 border-l-4 border-l-neutral-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-400">
              <User className="w-4 h-4" />
              <span>Kein Kunde zugewiesen</span>
            </div>
            <button
              onClick={openCustomerModal}
              className="btn btn-primary btn-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Kunde zuweisen
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "text-orange-400 border-b-2 border-orange-400"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4 inline mr-1.5" />
            {tab.label}
            {"count" in tab && (tab as { count?: number }).count !== undefined && (tab as { count?: number }).count! > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-neutral-800 rounded">
                {(tab as { count?: number }).count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Quote Status */}
            {quotes.length > 0 && (() => {
              const firstQuote = quotes[0];
              const isExported = !!firstQuote.lexware_quotation_id;
              return (
              <div 
                className="card p-4 md:col-span-2 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                onClick={() => {
                  if (isExported) {
                    window.open(`/api/lexware/quote-pdf?lexwareId=${firstQuote.lexware_quotation_id}`, "_blank");
                  } else {
                    router.push(`/quotes/${firstQuote.id}`);
                  }
                }}
              >
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  {isExported ? <FileText className="w-4 h-4 text-blue-400" /> : <FileSignature className="w-4 h-4" />}
                  Angebot
                  {quotes.length > 1 && (
                    <span className="text-xs text-neutral-500 font-normal">
                      (+{quotes.length - 1} weitere)
                    </span>
                  )}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium hover:text-[#fa432a]">
                      {firstQuote.package_title || firstQuote.title}
                    </p>
                    <p className={`text-xs ${isExported ? "text-blue-400" : "text-neutral-500"}`}>
                      {firstQuote.lexware_quote_number || firstQuote.quote_number || `#${firstQuote.id.slice(0, 6)}`} · {new Date(firstQuote.quote_date).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-1 rounded ${
                      firstQuote.status === "accepted" ? "bg-green-500/20 text-green-400" :
                      firstQuote.status === "rejected" ? "bg-red-500/20 text-red-400" :
                      firstQuote.status === "draft" ? "bg-neutral-500/20 text-neutral-400" :
                      "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {firstQuote.status === "draft" ? "Entwurf" :
                       firstQuote.status === "accepted" ? "Angenommen" :
                       firstQuote.status === "rejected" ? "Abgelehnt" :
                       firstQuote.status === "sent" ? "Versendet" : "Offen"}
                    </span>
                    <p className="text-lg font-bold text-white mt-1">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(firstQuote.total_amount)}
                    </p>
                  </div>
                </div>
              </div>
            );})()}

            {/* Quick Stats */}
            <div className="card p-4">
              <h3 className="font-semibold text-white mb-3">Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">Angebote</span>
                  <span className="text-white">{quotes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Termine</span>
                  <span className="text-white">{appointments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Abgeschlossen</span>
                  <span className="text-green-400">
                    {appointments.filter(a => a.status === "completed").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Subunternehmer</span>
                  <span className="text-white">{assignedSubs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Dokumente</span>
                  <span className="text-white">{documents.length}</span>
                </div>
              </div>
            </div>

            {/* Next Appointment */}
            <div className="card p-4">
              <h3 className="font-semibold text-white mb-3">Nächster Termin</h3>
              {appointments.filter(a => a.status !== "completed" && a.status !== "cancelled")[0] ? (
                <div>
                  <p className="font-medium text-white">
                    {appointments.filter(a => a.status !== "completed")[0].title}
                  </p>
                  <p className="text-sm text-neutral-400 mt-1">
                    {new Date(appointments.filter(a => a.status !== "completed")[0].start_time).toLocaleString("de-DE")}
                  </p>
                </div>
              ) : (
                <p className="text-neutral-500 text-sm">Keine anstehenden Termine</p>
              )}
            </div>
          </div>
        )}

        {/* Quotes */}
        {activeTab === "quotes" && (
          <QuotesTab 
            quotes={quotes} 
            projectId={project.id}
            customerId={project.customer_id}
            onRefresh={loadData}
          />
        )}

        {/* Tasks */}
        {activeTab === "tasks" && (
          <TasksTab 
            tasks={tasks}
            projectId={project.id}
            users={allUsers}
            subcontractors={allSubcontractors}
            onRefresh={loadData}
          />
        )}

        {/* Appointments */}
        {activeTab === "appointments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={openNewAppointment}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                Termin hinzufügen
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="card p-8 text-center text-neutral-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Noch keine Termine</p>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div 
                    key={appt.id} 
                    className="card p-4 hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    onClick={() => openEditAppointment(appt)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-neutral-400">{appointmentTypeLabels[appt.appointment_type]}</span>
                          <span className={`badge ${appointmentStatusColors[appt.status]}`}>
                            {appointmentStatusLabels[appt.status]}
                          </span>
                        </div>
                        <h4 className="font-semibold text-white">{appt.title}</h4>
                        <p className="text-sm text-neutral-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {new Date(appt.start_time).toLocaleString("de-DE")}
                        </p>
                        {appt.description && (
                          <p className="text-sm text-neutral-500 mt-2">{appt.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditAppointment(appt); }}
                          className="btn btn-ghost btn-sm"
                          title="Bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {appt.status !== "completed" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateAppointmentStatus(appt.id, "completed"); }}
                            className="btn btn-ghost btn-sm text-green-400"
                            title="Als erledigt markieren"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Subcontractors */}
        {activeTab === "subcontractors" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => setShowSubcontractorModal(true)}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                Subunternehmer zuweisen
              </button>
            </div>

            {assignedSubs.length === 0 ? (
              <div className="card p-8 text-center text-neutral-500">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Noch keine Subunternehmer zugewiesen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignedSubs.map((assignment) => (
                  <div key={assignment.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white">
                          {assignment.subcontractor?.company_name || "Unbekannt"}
                        </h4>
                        <p className="text-sm text-neutral-400">
                          {assignment.trade} • {assignment.scope || "Kein Arbeitsumfang definiert"}
                        </p>
                      </div>
                      <button
                        onClick={() => removeSubcontractor(assignment.id)}
                        className="btn btn-ghost btn-sm text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Documents */}
        {activeTab === "documents" && (() => {
          const docCategories: { key: string; label: string; Icon: LucideIcon }[] = [
            { key: "vertrag", label: "Verträge", Icon: FileSignature },
            { key: "angebot", label: "Angebote", Icon: FileText },
            { key: "rechnung", label: "Rechnungen", Icon: Receipt },
            { key: "aufmass", label: "Aufmaße", Icon: Ruler },
            { key: "plan", label: "Pläne", Icon: ClipboardList },
            { key: "foto", label: "Fotos", Icon: Camera },
            { key: "protokoll", label: "Protokolle", Icon: FileCheck },
            { key: "unterschrift", label: "Unterschriften", Icon: Pencil },
            { key: "datenschutz", label: "Datenschutz", Icon: Shield },
            { key: "sonstiges", label: "Sonstiges", Icon: Folder },
          ];

          const groupedDocs = docCategories
            .map(cat => ({
              ...cat,
              docs: documents.filter(d => d.document_type === cat.key)
            }))
            .filter(cat => cat.docs.length > 0);

          return (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-sm text-neutral-400">{documents.length} Dokumente</p>
                <button 
                  onClick={() => setShowDocumentModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Hochladen
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="card p-8 text-center text-neutral-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Noch keine Dokumente</p>
                  <button
                    onClick={() => setShowDocumentModal(true)}
                    className="btn btn-primary btn-sm mt-4"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Erstes Dokument hochladen
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedDocs.map(category => (
                    <div key={category.key}>
                      <h3 className="text-sm font-medium text-neutral-400 mb-2 flex items-center gap-2">
                        <category.Icon className="w-4 h-4" />
                        {category.label}
                        <span className="text-neutral-600">({category.docs.length})</span>
                      </h3>
                      <div className="card divide-y divide-neutral-800">
                        {category.docs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 hover:bg-neutral-800/50 cursor-pointer transition-colors group"
                            onClick={() => doc.storage_url && setPreviewDoc(doc)}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-5 h-5 text-neutral-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <h4 className="font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                                  {doc.name}
                                </h4>
                                <p className="text-xs text-neutral-500">
                                  {formatDate(doc.created_at)}
                                  {doc.file_size && ` • ${Math.round(doc.file_size / 1024)} KB`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setDeleteDocTarget({ id: doc.id, name: doc.name, storagePath: doc.storage_path }); 
                              }}
                              className="btn btn-ghost btn-sm text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Gallery */}
        {activeTab === "gallery" && (() => {
          const images = documents.filter(doc => 
            doc.mime_type?.startsWith("image/") || doc.document_type === "foto"
          );
          
          return (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Bilder ({images.length})</h3>
                <button
                  onClick={() => setShowDocumentModal(true)}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="w-4 h-4 mr-1" /> Bild hochladen
                </button>
              </div>

              {images.length === 0 ? (
                <div className="card p-8 text-center text-neutral-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Noch keine Bilder vorhanden</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {images.map((img, idx) => (
                    <div key={img.id} className="group relative">
                      <button
                        onClick={() => setLightboxIndex(idx)}
                        className="block w-full aspect-square rounded-lg overflow-hidden bg-neutral-800 hover:ring-2 hover:ring-orange-500 transition-all"
                      >
                        <img
                          src={img.storage_url || ""}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-sm text-white truncate">{img.name}</p>
                        <p className="text-xs text-neutral-400">{formatDate(img.created_at)}</p>
                      </div>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setDeleteDocTarget({ id: img.id, name: img.name, storagePath: img.storage_path }); 
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                        title="Löschen"
                      >
                        <Trash2 className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Lightbox */}
              {lightboxIndex !== null && images[lightboxIndex] && (
                <div 
                  className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
                  onClick={() => setLightboxIndex(null)}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => setLightboxIndex(null)}
                    className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-8 h-8" />
                  </button>

                  {/* Download Button */}
                  <a
                    href={images[lightboxIndex].storage_url || "#"}
                    download={images[lightboxIndex].name}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-4 right-16 p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <Download className="w-7 h-7" />
                  </a>

                  {/* Counter */}
                  <div className="absolute top-4 left-4 text-white/70 text-sm">
                    {lightboxIndex + 1} / {images.length}
                  </div>

                  {/* Previous Button */}
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
                    src={images[lightboxIndex].storage_url || ""}
                    alt={images[lightboxIndex].name}
                    className="max-h-[85vh] max-w-[90vw] object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />

                  {/* Next Button */}
                  {images.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
                      className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-10 h-10" />
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
        })()}

        {/* Forms Tab */}
        {activeTab === "forms" && (
          <div className="space-y-4">
            {/* Available Form Templates */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Formulare ausfüllen</h3>
            </div>
            
            {formTemplates.length === 0 ? (
              <div className="card p-8 text-center text-neutral-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Keine Formulare verfügbar</p>
                <p className="text-sm mt-1">Erstelle zuerst Formulare unter "Formulare"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {formTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => openFormFill(template)}
                    className="card p-4 text-left hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardList className="w-5 h-5 text-orange-400" />
                      <span className="font-medium text-white">{template.name}</span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-neutral-500 line-clamp-2">{template.description}</p>
                    )}
                    <div className="mt-2 text-xs text-neutral-600">
                      {template.fields?.length || 0} Felder
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Submitted Forms */}
            {formSubmissions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Ausgefüllte Formulare ({formSubmissions.length})</h3>
                <div className="card divide-y divide-neutral-800">
                  {formSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="p-4 flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
                    >
                      <div>
                        <h4 className="font-medium text-white">
                          {submission.form_template?.name || "Formular"}
                        </h4>
                        <p className="text-sm text-neutral-500">
                          Ausgefüllt am {formatDate(submission.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingSubmission(submission)}
                          className="btn btn-ghost btn-sm"
                          title="Ansehen"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSubmission(submission.id)}
                          className="btn btn-ghost btn-sm text-red-400"
                          title="Löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Appointment */}
      <Modal
        open={showAppointmentModal}
        onClose={() => { setShowAppointmentModal(false); setEditingAppointment(null); }}
        title={editingAppointment ? "Termin bearbeiten" : "Neuer Termin"}
      >
        <form onSubmit={saveAppointment} className="space-y-4">
          <div>
            <label className="label">Titel *</label>
            <input
              type="text"
              className="input"
              value={appointmentForm.title}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, title: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Terminart *</label>
            <select
              className="input"
              value={appointmentForm.appointment_type}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_type: e.target.value as AppointmentType })}
            >
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start *</label>
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.start_time}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Ende</label>
              <input
                type="datetime-local"
                className="input"
                value={appointmentForm.end_time}
                onChange={(e) => setAppointmentForm({ ...appointmentForm, end_time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Beteiligte Subunternehmer</label>
            <select
              className="input"
              multiple
              value={appointmentForm.subcontractor_ids}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setAppointmentForm({ ...appointmentForm, subcontractor_ids: values });
              }}
            >
              {allSubcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.company_name}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">Strg/Cmd gedrückt halten für Mehrfachauswahl</p>
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              value={appointmentForm.description}
              onChange={(e) => setAppointmentForm({ ...appointmentForm, description: e.target.value })}
            />
          </div>

          {editingAppointment && (
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editingAppointment.status}
                onChange={(e) => {
                  updateAppointmentStatus(editingAppointment.id, e.target.value as AppointmentStatus);
                  setEditingAppointment({ ...editingAppointment, status: e.target.value as AppointmentStatus });
                }}
              >
                {Object.entries(appointmentStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {editingAppointment && (
                <button 
                  type="button" 
                  onClick={() => { deleteAppointment(editingAppointment.id); setShowAppointmentModal(false); }}
                  className="btn btn-ghost text-red-400"
                >
                  Löschen
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowAppointmentModal(false); setEditingAppointment(null); }} className="btn btn-ghost">
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Spinner /> : (editingAppointment ? "Speichern" : "Termin anlegen")}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Assign Subcontractor */}
      <Modal
        open={showSubcontractorModal}
        onClose={() => setShowSubcontractorModal(false)}
        title="Subunternehmer zuweisen"
      >
        <form onSubmit={assignSubcontractor} className="space-y-4">
          <div>
            <label className="label">Subunternehmer auswählen *</label>
            <select
              className="input"
              value={selectedSubId}
              onChange={(e) => setSelectedSubId(e.target.value)}
              required
            >
              <option value="">-- Bitte wählen --</option>
              {allSubcontractors
                .filter(s => !assignedSubs.some(a => a.subcontractor_id === s.id))
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.company_name} ({sub.trade})
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowSubcontractorModal(false)} className="btn btn-ghost">
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !selectedSubId}>
              {saving ? <Spinner /> : "Zuweisen"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Upload Document */}
      <Modal
        open={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        title="Dokument hochladen"
      >
        <form onSubmit={uploadDocument} className="space-y-4">
          <div>
            <label className="label">Datei auswählen *</label>
            <input
              type="file"
              className="input file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-orange-500 file:text-white hover:file:bg-orange-600"
              required
            />
          </div>

          <div>
            <label className="label">Dokumentname</label>
            <input
              type="text"
              name="docName"
              className="input"
              placeholder="Optional - sonst wird Dateiname verwendet"
            />
          </div>

          <div>
            <label className="label">Dokumenttyp</label>
            <select name="docType" className="input" defaultValue="sonstiges">
              <option value="vertrag">Vertrag</option>
              <option value="angebot">Angebot</option>
              <option value="rechnung">Rechnung</option>
              <option value="aufmass">Aufmaß</option>
              <option value="plan">Plan</option>
              <option value="foto">Foto</option>
              <option value="protokoll">Protokoll</option>
              <option value="unterschrift">Unterschrift</option>
              <option value="datenschutz">Datenschutz</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowDocumentModal(false)} className="btn btn-ghost">
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? <Spinner /> : "Hochladen"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Preview Overlay */}
      {previewDoc && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
          onClick={() => setPreviewDoc(null)}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-800">
            <div className="text-white">
              <h3 className="font-medium">{previewDoc.name}</h3>
              <p className="text-sm text-neutral-400">
                {previewDoc.document_type} • {formatDate(previewDoc.created_at)}
                {previewDoc.file_size && ` • ${Math.round(previewDoc.file_size / 1024)} KB`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={previewDoc.storage_url || "#"}
                download={previewDoc.name}
                onClick={(e) => e.stopPropagation()}
                className="btn btn-ghost btn-sm text-white"
                title="Herunterladen"
              >
                <Download className="w-5 h-5" />
              </a>
              <a
                href={previewDoc.storage_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="btn btn-ghost btn-sm text-white"
                title="In neuem Tab öffnen"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                onClick={() => setPreviewDoc(null)}
                className="btn btn-ghost btn-sm text-white"
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
                  src={previewDoc.storage_url || ""}
                  alt={previewDoc.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : previewDoc.mime_type === "application/pdf" ? (
              <iframe
                src={previewDoc.storage_url || ""}
                className="w-full h-full rounded-lg bg-white"
                title={previewDoc.name}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400">
                <FileText className="w-24 h-24 mb-4 opacity-50" />
                <p className="text-lg mb-2">Vorschau nicht verfügbar</p>
                <p className="text-sm mb-4">Dateityp: {previewDoc.mime_type || "Unbekannt"}</p>
                <a
                  href={previewDoc.storage_url || "#"}
                  download={previewDoc.name}
                  className="btn btn-primary"
                >
                  <Download className="w-4 h-4 mr-2" /> Herunterladen
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Change Customer */}
      <Modal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Kunde zuweisen"
      >
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Kunde suchen..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="input w-full"
            />
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-1">
            <button
              onClick={() => setSelectedCustomerId("")}
              className={`w-full text-left px-3 py-2 rounded transition-colors ${
                selectedCustomerId === "" 
                  ? "bg-orange-500/20 text-orange-400" 
                  : "hover:bg-neutral-800 text-neutral-400"
              }`}
            >
              <span className="italic">Kein Kunde</span>
            </button>
            {allCustomers
              .filter(c => 
                !customerSearch ||
                c.last_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.company_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.first_name?.toLowerCase().includes(customerSearch.toLowerCase())
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    selectedCustomerId === c.id 
                      ? "bg-orange-500/20 text-orange-400" 
                      : "hover:bg-neutral-800 text-white"
                  }`}
                >
                  <div className="font-medium">
                    {c.company_name || `${c.first_name || ""} ${c.last_name}`}
                  </div>
                  {c.city && (
                    <div className="text-xs text-neutral-500">{c.city}</div>
                  )}
                </button>
              ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button 
              type="button" 
              onClick={() => setShowCustomerModal(false)} 
              className="btn btn-ghost"
            >
              Abbrechen
            </button>
            <button 
              onClick={updateCustomer} 
              className="btn btn-primary" 
              disabled={saving}
            >
              {saving ? <Spinner /> : "Speichern"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Fill Form */}
      <Modal
        open={showFormModal}
        onClose={() => { setShowFormModal(false); setSelectedTemplate(null); }}
        title={selectedTemplate?.name || "Formular ausfüllen"}
        size="lg"
      >
        {selectedTemplate && (
          <form onSubmit={submitForm} className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedTemplate.fields?.map((field: any) => (
              <div key={field.id}>
                <label className="label">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                
                {field.type === "text" && (
                  <input
                    type="text"
                    className="input"
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
                
                {field.type === "textarea" && (
                  <textarea
                    className="input min-h-[100px]"
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
                
                {field.type === "number" && (
                  <input
                    type="number"
                    className="input"
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
                
                {field.type === "date" && (
                  <input
                    type="date"
                    className="input"
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    required={field.required}
                  />
                )}
                
                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData[field.id] || false}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-neutral-300">{field.placeholder || "Ja"}</span>
                  </label>
                )}

                {field.type === "toggle" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData[field.id] || false}
                      onChange={(e) => setFormData({ ...formData, [field.id]: e.target.checked })}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-neutral-300">{formData[field.id] ? "Ja" : "Nein"}</span>
                  </label>
                )}
                
                {field.type === "select" && (
                  <select
                    className="input"
                    value={formData[field.id] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                    required={field.required}
                  >
                    <option value="">Bitte wählen...</option>
                    {field.options?.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.type === "signature" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <canvas
                        id={`sig-${field.id}`}
                        className="w-full border-2 border-neutral-600 rounded-lg bg-white cursor-crosshair touch-none"
                        style={{ height: "150px" }}
                        ref={(canvas) => {
                          if (canvas && !canvas.dataset.initialized) {
                            const rect = canvas.getBoundingClientRect();
                            const dpr = window.devicePixelRatio || 1;
                            canvas.width = rect.width * dpr;
                            canvas.height = rect.height * dpr;
                            const ctx = canvas.getContext("2d");
                            if (ctx) {
                              ctx.scale(dpr, dpr);
                              ctx.lineCap = "round";
                              ctx.lineJoin = "round";
                              ctx.lineWidth = 2.5;
                              ctx.strokeStyle = "#000";
                            }
                            canvas.dataset.initialized = "true";
                          }
                        }}
                        onMouseDown={(e) => {
                          const canvas = e.currentTarget;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          let lastX = e.clientX - rect.left;
                          let lastY = e.clientY - rect.top;
                          ctx.beginPath();
                          ctx.moveTo(lastX, lastY);
                          
                          const onMove = (ev: MouseEvent) => {
                            const x = ev.clientX - rect.left;
                            const y = ev.clientY - rect.top;
                            ctx.lineTo(x, y);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                          };
                          const onUp = () => {
                            setFormData({ ...formData, [field.id]: canvas.toDataURL() });
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          const canvas = e.currentTarget;
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;
                          const rect = canvas.getBoundingClientRect();
                          const touch = e.touches[0];
                          let lastX = touch.clientX - rect.left;
                          let lastY = touch.clientY - rect.top;
                          ctx.beginPath();
                          ctx.moveTo(lastX, lastY);
                          
                          const onMove = (ev: TouchEvent) => {
                            ev.preventDefault();
                            const t = ev.touches[0];
                            const x = t.clientX - rect.left;
                            const y = t.clientY - rect.top;
                            ctx.lineTo(x, y);
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                          };
                          const onEnd = () => {
                            setFormData({ ...formData, [field.id]: canvas.toDataURL() });
                            canvas.removeEventListener("touchmove", onMove);
                            canvas.removeEventListener("touchend", onEnd);
                          };
                          canvas.addEventListener("touchmove", onMove, { passive: false });
                          canvas.addEventListener("touchend", onEnd);
                        }}
                      />
                      {!formData[field.id] && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-neutral-400 text-sm">Hier unterschreiben</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost text-neutral-400"
                      onClick={() => {
                        const canvas = document.getElementById(`sig-${field.id}`) as HTMLCanvasElement;
                        if (canvas) {
                          const ctx = canvas.getContext("2d");
                          const dpr = window.devicePixelRatio || 1;
                          if (ctx) {
                            ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
                          }
                          setFormData({ ...formData, [field.id]: "" });
                        }
                      }}
                    >
                      Unterschrift löschen
                    </button>
                    {formData[field.id] && (
                      <div className="text-xs text-green-500 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Unterschrift erfasst
                      </div>
                    )}
                  </div>
                )}

                {field.type === "photo" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="input text-sm"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setFormData({ ...formData, [field.id]: reader.result });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formData[field.id] && (
                      <img 
                        src={formData[field.id]} 
                        alt="Foto" 
                        className="max-h-32 rounded border border-neutral-700"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-800 sticky bottom-0 bg-[#141414] py-3">
              <button
                type="button"
                onClick={() => { setShowFormModal(false); setSelectedTemplate(null); }}
                className="btn btn-ghost"
              >
                Abbrechen
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <Spinner /> : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: View Submission */}
      <Modal
        open={!!viewingSubmission}
        onClose={() => setViewingSubmission(null)}
        title={viewingSubmission?.form_template?.name || "Ausgefülltes Formular"}
        size="lg"
      >
        {viewingSubmission && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="text-sm text-neutral-500 mb-4">
              Ausgefüllt am {formatDate(viewingSubmission.created_at)}
            </div>
            
            {Object.entries(viewingSubmission.data || {}).map(([fieldId, value]) => {
              // Find the field label from the template
              const template = formTemplates.find(t => t.id === viewingSubmission.form_template_id);
              const field = template?.fields?.find((f: any) => f.id === fieldId);
              const isImage = typeof value === "string" && value.startsWith("data:image");
              
              return (
                <div key={fieldId} className="border-b border-neutral-800 pb-3">
                  <div className="text-sm text-neutral-400">{field?.label || fieldId}</div>
                  <div className="text-white mt-1">
                    {isImage ? (
                      <img src={value as string} alt={field?.label || "Bild"} className="max-h-40 rounded border border-neutral-700 bg-white" />
                    ) : typeof value === "boolean" ? (
                      value ? "Ja" : "Nein"
                    ) : (
                      String(value) || "—"
                    )}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setViewingSubmission(null)}
                className="btn btn-ghost"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Document Modal */}
      <Modal open={!!deleteDocTarget} onClose={() => setDeleteDocTarget(null)} title="Dokument löschen">
        <div className="space-y-4">
          <p className="text-neutral-300">
            Möchtest du das Dokument <span className="font-semibold text-white">"{deleteDocTarget?.name}"</span> wirklich löschen?
          </p>
          <p className="text-sm text-neutral-500">
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteDocTarget(null)}
              className="flex-1 btn btn-secondary"
            >
              Abbrechen
            </button>
            <button
              onClick={confirmDeleteDocument}
              disabled={deletingDoc}
              className="flex-1 btn bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingDoc ? "Löschen..." : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Quotes Tab Component
function QuotesTab({ quotes, projectId, customerId, onRefresh }: {
  quotes: any[];
  projectId: string;
  customerId: string | null;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!statusMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStatusMenuId(null);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [statusMenuId]);

  async function updateStatus(quoteId: string, status: string) {
    await supabase
      .from("wawi_quotes")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", quoteId);
    setStatusMenuId(null);
    onRefresh();
  }

  const statusOptions = [
    { key: "draft", label: "Entwurf", bg: "bg-neutral-500/20", text: "text-neutral-400" },
    { key: "sent_to_lexware", label: "An Lexware", bg: "bg-blue-500/20", text: "text-blue-400" },
    { key: "sent", label: "Versendet", bg: "bg-cyan-500/20", text: "text-cyan-400" },
    { key: "open", label: "Offen", bg: "bg-yellow-500/20", text: "text-yellow-400" },
    { key: "accepted", label: "Angenommen", bg: "bg-green-500/20", text: "text-green-400" },
    { key: "rejected", label: "Abgelehnt", bg: "bg-red-500/20", text: "text-red-400" },
  ];

  const getStatusInfo = (status: string) => statusOptions.find(s => s.key === status) || statusOptions[0];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => router.push(`/quotes/new?project=${projectId}&customer=${customerId}`)}
          className="btn btn-primary btn-sm"
        >
          <Plus className="w-4 h-4" />
          Neues Angebot
        </button>
      </div>

      {quotes.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Noch keine Angebote</p>
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((quote) => {
            const statusInfo = getStatusInfo(quote.status);
            const isExported = !!quote.lexware_quotation_id;
            return (
              <div 
                key={quote.id} 
                className={`card px-4 py-3 transition-colors relative cursor-pointer hover:bg-neutral-800/50 ${statusMenuId === quote.id ? "z-50" : ""}`}
                onClick={() => {
                  // If exported to Lexware, open PDF directly
                  if (isExported) {
                    window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank");
                  } else {
                    router.push(`/quotes/${quote.id}`);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isExported && (
                        <span title="PDF öffnen">
                          <FileText className="w-3 h-3 text-blue-400" />
                        </span>
                      )}
                      <span className={`text-xs font-mono ${isExported ? "text-blue-400" : "text-neutral-500"}`}>
                        {quote.lexware_quote_number || quote.quote_number || `#${quote.id.slice(0, 6)}`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuId(statusMenuId === quote.id ? null : quote.id);
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded hover:opacity-80 ${statusInfo.bg} ${statusInfo.text}`}
                      >
                        {statusInfo.label}
                      </button>
                    </div>
                    <h4 className="text-sm font-medium text-white hover:text-[#fa432a]">
                      {quote.package_title || quote.title}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-white">
                      {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
                    </span>
                    <p className="text-xs text-neutral-500">
                      {new Date(quote.quote_date).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>

                {/* Status Menu */}
                {statusMenuId === quote.id && (
                  <div 
                    ref={menuRef}
                    className="absolute left-24 top-2 z-[100] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 min-w-[140px]"
                  >
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus(quote.id, opt.key);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#262626] flex items-center gap-2 ${
                          quote.status === opt.key ? "text-[#fa432a]" : "text-neutral-300"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${opt.bg}`} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ tasks, projectId, users, subcontractors, onRefresh }: {
  tasks: any[];
  projectId: string;
  users: any[];
  subcontractors: any[];
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("normal");
  const [dueDate, setDueDate] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [assignedSubId, setAssignedSubId] = useState<string>("");

  const statusOptions = [
    { key: "open", label: "Offen", color: "bg-yellow-500/20 text-yellow-400" },
    { key: "in_progress", label: "In Arbeit", color: "bg-blue-500/20 text-blue-400" },
    { key: "done", label: "Erledigt", color: "bg-green-500/20 text-green-400" },
    { key: "cancelled", label: "Abgebrochen", color: "bg-neutral-500/20 text-neutral-400" },
  ];

  const priorityOptions = [
    { key: "low", label: "Niedrig", color: "text-neutral-400" },
    { key: "normal", label: "Normal", color: "text-white" },
    { key: "high", label: "Hoch", color: "text-orange-400" },
    { key: "urgent", label: "Dringend", color: "text-red-400" },
  ];

  function openNew() {
    setEditingTask(null);
    setTitle("");
    setDescription("");
    setStatus("open");
    setPriority("normal");
    setDueDate("");
    setAssignedUserId("");
    setAssignedSubId("");
    setShowModal(true);
  }

  function openEdit(task: any) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || "");
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date || "");
    setAssignedUserId(task.assigned_user_id || "");
    setAssignedSubId(task.assigned_subcontractor_id || "");
    setShowModal(true);
  }

  async function saveTask() {
    if (!title.trim()) return;
    setSaving(true);

    const taskData = {
      project_id: projectId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
      assigned_user_id: assignedUserId || null,
      assigned_subcontractor_id: assignedSubId || null,
    };

    let error;
    if (editingTask) {
      const result = await supabase
        .from("project_tasks")
        .update({ ...taskData, updated_at: new Date().toISOString() })
        .eq("id", editingTask.id);
      error = result.error;
    } else {
      const result = await supabase.from("project_tasks").insert(taskData);
      error = result.error;
    }

    if (error) {
      console.error("Error saving task:", error);
      alert(`Fehler: ${error.message}`);
    }

    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("Aufgabe löschen?")) return;
    await supabase.from("project_tasks").delete().eq("id", id);
    onRefresh();
  }

  async function toggleStatus(task: any) {
    const newStatus = task.status === "done" ? "open" : "done";
    await supabase
      .from("project_tasks")
      .update({ 
        status: newStatus, 
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString() 
      })
      .eq("id", task.id);
    onRefresh();
  }

  const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = tasks.filter(t => t.status === "done");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openNew} className="btn btn-primary btn-sm">
          <Plus className="w-4 h-4" />
          Neue Aufgabe
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Noch keine Aufgaben</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Open Tasks */}
          {openTasks.length > 0 && (
            <div className="space-y-2">
              {openTasks.map((task) => (
                <div key={task.id} className="card px-4 py-3 flex items-center gap-3">
                  <button
                    onClick={() => toggleStatus(task)}
                    className="w-5 h-5 rounded border-2 border-neutral-600 hover:border-green-400 flex items-center justify-center transition-colors"
                  >
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(task)}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${priorityOptions.find(p => p.key === task.priority)?.color}`}>
                        {task.title}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusOptions.find(s => s.key === task.status)?.color}`}>
                        {statusOptions.find(s => s.key === task.status)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                      {task.assigned_user?.display_name && (
                        <span>👤 {task.assigned_user.display_name}</span>
                      )}
                      {task.assigned_sub?.company_name && (
                        <span>🏢 {task.assigned_sub.company_name}</span>
                      )}
                      {task.due_date && (
                        <span>📅 {new Date(task.due_date).toLocaleDateString("de-DE")}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Done Tasks */}
          {doneTasks.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Erledigt ({doneTasks.length})</p>
              <div className="space-y-1">
                {doneTasks.map((task) => (
                  <div key={task.id} className="card px-4 py-2 flex items-center gap-3 opacity-60">
                    <button
                      onClick={() => toggleStatus(task)}
                      className="w-5 h-5 rounded border-2 border-green-500 bg-green-500/20 flex items-center justify-center"
                    >
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    </button>
                    <span className="text-sm text-neutral-400 line-through">{task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Task Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingTask ? "Aufgabe bearbeiten" : "Neue Aufgabe"}>
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Titel *</label>
            <input
              type="text"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Was ist zu tun?"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priorität</label>
              <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {priorityOptions.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Fällig am</label>
            <input
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Benutzer</label>
              <select className="input" value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
                <option value="">Nicht zugewiesen</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.display_name || u.username}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subunternehmer</label>
              <select className="input" value={assignedSubId} onChange={(e) => setAssignedSubId(e.target.value)}>
                <option value="">Nicht zugewiesen</option>
                {subcontractors.map(s => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowModal(false)} className="btn btn-ghost">
              Abbrechen
            </button>
            <button onClick={saveTask} disabled={saving || !title.trim()} className="btn btn-primary">
              {saving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
