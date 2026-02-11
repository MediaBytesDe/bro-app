"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { getTradeLabel, getTradeOptions, loadTradesFromDB } from "@/lib/trades";
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
  Building2,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Upload3DModel } from "@/components/upload-3d-model";
import type { 
  Project, 
  Customer, 
  Appointment,
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
  const [partnerJobs, setPartnerJobs] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
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
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Lightbox / Document Preview
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDocRaw] = useState<Document | null>(null);

  // Wrap setPreviewDoc to push/pop history for back-swipe support
  const setPreviewDoc = useCallback((doc: Document | null) => {
    if (doc) {
      window.history.pushState({ preview: true }, "");
      setPreviewDocRaw(doc);
    } else {
      setPreviewDocRaw(null);
    }
  }, []);

  // Close preview on browser back (swipe)
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (previewDoc) {
        e.preventDefault();
        setPreviewDocRaw(null);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [previewDoc]);
  
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

  // Partner Job Form
  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    trade: "dc_montage",
    scheduled_date: "",
    deadline: "",
  });

  const router = useRouter();
  const supabase = createClient();
  const [tradeOptions, setTradeOptions] = useState(getTradeOptions());

  const loadData = useCallback(async () => {
    setLoading(true);
    
    // Trades aus DB laden (für Labels)
    await loadTradesFromDB(supabase, true);
    setTradeOptions(getTradeOptions());

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

    // Load internal appointments
    const { data: appts } = await supabase
      .from("appointments")
      .select("*")
      .eq("project_id", project.id)
      .order("start_time", { ascending: true });
    
    // Load partner jobs for this project first
    const { data: partnerJobs } = await supabase
      .from("partner_jobs")
      .select("id")
      .eq("project_id", project.id);
    
    const jobIds = (partnerJobs || []).map(j => j.id);
    
    // Load partner job appointments for those jobs
    let partnerAppts: any[] = [];
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from("partner_job_appointments")
        .select(`
          id, title, date, time_start, time_end, notes,
          job:partner_jobs!job_id (
            id, title, trade,
            partner:partners!accepted_by_partner_id (id, company_name)
          )
        `)
        .in("job_id", jobIds)
        .order("date", { ascending: true });
      partnerAppts = data || [];
    }
    
    // Combine both - transform partner appointments to match Appointment interface
    const internalAppts = (appts || []).map((a: any) => ({
      ...a,
      _type: 'internal' as const,
    }));
    
    const partnerApptsTransformed = partnerAppts.filter((a: any) => a.job).map((a: any) => ({
      id: a.id,
      title: a.title,
      start_time: a.date && a.time_start ? `${a.date}T${a.time_start}` : a.date,
      end_time: a.date && a.time_end ? `${a.date}T${a.time_end}` : null,
      description: a.notes,
      status: 'scheduled' as const,
      appointment_type: a.job?.trade || 'sonstiges',
      _type: 'partner' as const,
      _partner_name: a.job?.partner?.company_name,
      _trade: a.job?.trade,
    }));
    
    const allAppts = [...internalAppts, ...partnerApptsTransformed].sort((a, b) => {
      const aTime = a.start_time ? new Date(a.start_time).getTime() : 0;
      const bTime = b.start_time ? new Date(b.start_time).getTime() : 0;
      return aTime - bTime;
    });
    
    setAppointments(allAppts as any);

    // Load partner jobs for this project
    const { data: jobs } = await supabase
      .from("partner_jobs")
      .select(`
        *,
        partner:partners!accepted_by_partner_id (id, company_name, email, phone),
        appointments:partner_job_appointments (id, title, date, time_start)
      `)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });
    setPartnerJobs(jobs || []);

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
      .select("*, assigned_user:users(id, display_name), assigned_partner:partners(id, company_name)")
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
  }, [project.id, project.customer_id, project.parent_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = useCallback(async (newStatus: string) => {
    const { error } = await supabase
      .from("projects")
      .update({ workfolder_status: newStatus })
      .eq("id", project.id);
    
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    setCurrentStatus(newStatus);
  }, [project.id]);

  const openCustomerModal = useCallback(async () => {
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
  }, [project.customer_id]);

  const updateCustomer = useCallback(async () => {
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
  }, [selectedCustomerId, project.id, loadData]);

  const getStatusDef = useCallback((key: string | null): WorkfolderStatusDef | undefined => {
    return statusOptions.find(s => s.key === key);
  }, [statusOptions]);

  const openNewAppointment = useCallback(() => {
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
  }, []);

  const openEditAppointment = useCallback((apt: Appointment) => {
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
  }, []);

  const saveAppointment = useCallback(async (e: React.FormEvent) => {
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
  }, [editingAppointment, appointmentForm, project.id, project.customer_id, loadData]);

  const updateAppointmentStatus = useCallback(async (aptId: string, newStatus: AppointmentStatus) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", aptId);
    
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    loadData();
  }, [loadData]);

  const deleteAppointment = useCallback(async (aptId: string) => {
    if (!confirm("Termin wirklich löschen?")) return;
    
    const { error } = await supabase.from("appointments").delete().eq("id", aptId);
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    loadData();
  }, [loadData]);

  // Partner Job functions
  const openNewJob = useCallback(() => {
    setEditingJob(null);
    setJobForm({
      title: "",
      description: "",
      trade: "dc_montage",
      scheduled_date: "",
      deadline: "",
    });
    setShowJobModal(true);
  }, []);

  const openEditJob = useCallback((job: any) => {
    setEditingJob(job);
    setJobForm({
      title: job.title || "",
      description: job.description || "",
      trade: job.trade || "dc_montage",
      scheduled_date: job.scheduled_date || "",
      deadline: job.deadline || "",
    });
    setShowJobModal(true);
  }, []);

  const saveJob = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      project_id: project.id,
      title: jobForm.title,
      description: jobForm.description || null,
      trade: jobForm.trade,
      scheduled_date: jobForm.scheduled_date || null,
      deadline: jobForm.deadline || null,
      status: "open",
    };

    let error;
    if (editingJob) {
      const { status, ...updatePayload } = payload; // Don't overwrite status on edit
      ({ error } = await supabase.from("partner_jobs").update(updatePayload).eq("id", editingJob.id));
    } else {
      ({ error } = await supabase.from("partner_jobs").insert(payload));
    }

    setSaving(false);

    if (error) {
      alert("Fehler: " + error.message);
      return;
    }

    setShowJobModal(false);
    setEditingJob(null);
    loadData();
  }, [editingJob, jobForm, project.id, loadData]);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!confirm("Job wirklich löschen? Alle zugehörigen Termine werden ebenfalls gelöscht.")) return;
    
    const { error } = await supabase.from("partner_jobs").delete().eq("id", jobId);
    if (error) {
      alert("Fehler: " + error.message);
      return;
    }
    loadData();
  }, [loadData]);

  // Form functions
  const openFormFill = useCallback((template: any) => {
    setSelectedTemplate(template);
    setFormData({});
    setShowFormModal(true);
  }, []);

  const submitForm = useCallback(async (e: React.FormEvent) => {
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
  }, [selectedTemplate, project.id, project.customer_id, formData, loadData]);

  const deleteSubmission = useCallback(async (id: string) => {
    if (!confirm("Ausgefülltes Formular wirklich löschen?")) return;
    await supabase.from("form_submissions").delete().eq("id", id);
    loadData();
  }, [loadData]);

  const uploadDocument = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
  }, [project.id, project.customer_id, loadData]);

  const confirmDeleteDocument = useCallback(async () => {
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
  }, [deleteDocTarget, loadData]);

  const getCustomerAddress = useCallback(() => {
    if (!customer) return null;
    const parts = [customer.street, customer.postal_code, customer.city].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }, [customer]);

  // Memoize expensive calculations
  const nonDoneTasksCount = useMemo(() => tasks.filter(t => t.status !== "done").length, [tasks]);

  const completedAppointmentsCount = useMemo(() =>
    appointments.filter(a => a.status === "completed").length,
    [appointments]
  );

  const nextAppointment = useMemo(() =>
    appointments.filter(a => a.status !== "completed" && a.status !== "cancelled")[0],
    [appointments]
  );

  const uniquePartners = useMemo(() =>
    partnerJobs
      .filter((j: any) => j.partner && j.status !== 'open')
      .map((j: any) => ({ id: j.partner.id, company_name: j.partner.company_name }))
      .filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx),
    [partnerJobs]
  );

  // Memoize filtered images for gallery
  const galleryImages = useMemo(() =>
    documents.filter(doc =>
      doc.mime_type?.startsWith("image/") || doc.document_type === "foto"
    ),
    [documents]
  );

  // Memoize tabs array to avoid recalculation on every render
  const tabs = useMemo(() => [
    { id: "overview", label: "Übersicht", icon: FileText },
    { id: "quotes", label: "Angebote", icon: FileSignature, count: quotes.length },
    { id: "tasks", label: "Aufgaben", icon: ListTodo, count: nonDoneTasksCount },
    { id: "appointments", label: "Termine", icon: Calendar, count: appointments.length },
    { id: "subcontractors", label: "Partner", icon: Building2, count: partnerJobs.length },
    { id: "documents", label: "Dokumente", icon: FileText, count: documents.length },
    { id: "gallery", label: "Galerie", icon: ImageIcon },
    { id: "forms", label: "Formulare", icon: ClipboardList, count: formSubmissions.length },
  ] as const, [quotes.length, nonDoneTasksCount, appointments.length, partnerJobs.length, documents.length, formSubmissions.length]);

  // Memoize sorted status options
  const sortedStatusOptions = useMemo(() =>
    statusOptions.sort((a, b) => a.sort - b.sort),
    [statusOptions]
  );

  // Memoize filtered customers for customer modal
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return allCustomers;
    const search = customerSearch.toLowerCase();
    return allCustomers.filter(c =>
      c.last_name?.toLowerCase().includes(search) ||
      c.first_name?.toLowerCase().includes(search) ||
      c.company_name?.toLowerCase().includes(search)
    );
  }, [allCustomers, customerSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

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
                {sortedStatusOptions.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            
            {/* Customer Portal Preview Button */}
            {customer && (
              <button
                onClick={() => window.open(`/portal?impersonate=${customer.id}`, '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                title="Als dieser Kunde das Portal öffnen"
              >
                <Eye className="w-4 h-4" />
                Kundenansicht
              </button>
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
                    {completedAppointmentsCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Partner-Aufträge</span>
                  <span className="text-white">{partnerJobs.length}</span>
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
              {nextAppointment ? (
                <div>
                  <p className="font-medium text-white">
                    {nextAppointment.title}
                  </p>
                  <p className="text-sm text-neutral-400 mt-1">
                    {new Date(nextAppointment.start_time).toLocaleString("de-DE")}
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
            partners={uniquePartners}
            onRefresh={loadData}
          />
        )}

        {/* Appointments */}
        {activeTab === "appointments" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openNewAppointment} className="btn btn-primary btn-sm">
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
              <div className="card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-neutral-900/50">
                      <th className="text-left py-2 px-4 w-10"></th>
                      <th className="text-left py-2 px-4">Termin</th>
                      <th className="text-left py-2 px-4 w-36">Typ</th>
                      <th className="text-left py-2 px-4 w-40">Datum</th>
                      <th className="text-left py-2 px-4 w-28">Status</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((appt: any) => {
                      const isPartner = appt._type === 'partner';
                      const isCompleted = appt.status === 'completed';
                      
                      return (
                        <tr 
                          key={appt.id} 
                          className={`border-b border-neutral-800/50 last:border-0 transition-colors ${
                            isCompleted ? "opacity-50" : "hover:bg-neutral-800/30"
                          } ${!isPartner ? "cursor-pointer" : ""}`}
                          onClick={() => !isPartner && openEditAppointment(appt)}
                        >
                          {/* Indicator */}
                          <td className="py-3 px-4">
                            {isPartner ? (
                              <div className="w-2 h-2 rounded-full bg-[#fa432a]" title="Partner-Termin" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-blue-400" title="Interner Termin" />
                            )}
                          </td>

                          {/* Info */}
                          <td className="py-3 px-4">
                            <p className={`font-medium ${isCompleted ? "line-through text-neutral-500" : "text-white"}`}>
                              {appt.title}
                            </p>
                            {isPartner && appt._partner_name && (
                              <p className="text-xs text-[#fa432a] mt-0.5">{appt._partner_name}</p>
                            )}
                            {appt.description && (
                              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{appt.description}</p>
                            )}
                          </td>

                          {/* Type */}
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                              isPartner 
                                ? "bg-[#fa432a]/20 text-[#fa432a]" 
                                : "bg-blue-500/20 text-blue-400"
                            }`}>
                              {isPartner 
                                ? getTradeLabel(appt._trade)
                                : (appointmentTypeLabels[appt.appointment_type as keyof typeof appointmentTypeLabels] || appt.appointment_type)
                              }
                            </span>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-4 text-sm text-neutral-400">
                            {appt.start_time 
                              ? new Date(appt.start_time).toLocaleString("de-DE", { 
                                  day: "2-digit", month: "2-digit", year: "2-digit",
                                  hour: "2-digit", minute: "2-digit"
                                })
                              : "–"
                            }
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {!isPartner ? (
                              <select
                                value={appt.status}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => updateAppointmentStatus(appt.id, e.target.value as any)}
                                className="bg-neutral-800 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs"
                              >
                                {Object.entries(appointmentStatusLabels).map(([key, label]) => (
                                  <option key={key} value={key}>{label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-neutral-500">–</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4">
                            {!isPartner && (
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditAppointment(appt); }}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteAppointment(appt.id); }}
                                  className="text-neutral-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Subcontractors */}
        {activeTab === "subcontractors" && (() => {
          const jobStatusColors: Record<string, string> = {
            open: "bg-yellow-500/20 text-yellow-400",
            accepted: "bg-green-500/20 text-green-400",
            in_progress: "bg-blue-500/20 text-blue-400",
            completed: "bg-neutral-500/20 text-neutral-400",
            cancelled: "bg-red-500/20 text-red-400",
          };
          const jobStatusLabels: Record<string, string> = {
            open: "Im Pool",
            accepted: "Angenommen",
            in_progress: "In Arbeit",
            completed: "Abgeschlossen",
            cancelled: "Abgebrochen",
          };
          return (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={openNewJob} className="btn btn-primary btn-sm">
                  <Plus className="w-4 h-4" />
                  Job erstellen
                </button>
              </div>

              {partnerJobs.length === 0 ? (
                <div className="card p-8 text-center text-neutral-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Noch keine Partner-Aufträge</p>
                  <p className="text-sm mt-1">Erstelle einen Job, der dann im Partner-Pool erscheint</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-neutral-900/50">
                        <th className="text-left py-2 px-4">Job</th>
                        <th className="text-left py-2 px-4 w-32">Gewerk</th>
                        <th className="text-left py-2 px-4 w-40">Partner</th>
                        <th className="text-left py-2 px-4 w-28">Datum</th>
                        <th className="text-left py-2 px-4 w-28">Status</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {partnerJobs.map((job: any) => {
                        const isCompleted = job.status === 'completed';
                        
                        return (
                          <tr 
                            key={job.id} 
                            className={`border-b border-neutral-800/50 last:border-0 transition-colors cursor-pointer ${
                              isCompleted ? "opacity-50" : "hover:bg-neutral-800/30"
                            }`}
                            onClick={() => openEditJob(job)}
                          >
                            {/* Job Info */}
                            <td className="py-3 px-4">
                              <p className={`font-medium ${isCompleted ? "text-neutral-500" : "text-white"}`}>
                                {job.title}
                              </p>
                              {job.description && (
                                <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{job.description}</p>
                              )}
                            </td>

                            {/* Trade */}
                            <td className="py-3 px-4">
                              <span className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-300 whitespace-nowrap">
                                {getTradeLabel(job.trade)}
                              </span>
                            </td>

                            {/* Partner */}
                            <td className="py-3 px-4">
                              {job.partner ? (
                                <span className="text-sm text-[#fa432a]">{job.partner.company_name}</span>
                              ) : (
                                <span className="text-sm text-neutral-500">– wartet –</span>
                              )}
                            </td>

                            {/* Date */}
                            <td className="py-3 px-4 text-sm text-neutral-400">
                              {job.scheduled_date 
                                ? new Date(job.scheduled_date).toLocaleDateString("de-DE")
                                : "–"
                              }
                            </td>

                            {/* Status */}
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-1 rounded ${jobStatusColors[job.status] || 'bg-neutral-700 text-neutral-300'}`}>
                                {jobStatusLabels[job.status] || job.status}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4">
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); openEditJob(job); }}
                                  className="text-neutral-500 hover:text-white"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                                  className="text-neutral-500 hover:text-red-400"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
          );
        })()}

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

              {/* 3D Model Upload */}
              <div className="card p-4">
                <Upload3DModel 
                  projectId={project.id} 
                  onSuccess={() => loadData()}
                />
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
          const images = galleryImages;

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
                        <Image
                          src={img.storage_url || ""}
                          alt={img.name}
                          width={400}
                          height={400}
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
                  <Image
                    src={images[lightboxIndex].storage_url || ""}
                    alt={images[lightboxIndex].name}
                    width={1920}
                    height={1080}
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
                <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
                  Ausgefüllte Formulare ({formSubmissions.length})
                </h3>
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-neutral-900/50">
                        <th className="text-left py-2 px-4">Formular</th>
                        <th className="text-left py-2 px-4 w-40">Ausgefüllt am</th>
                        <th className="w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formSubmissions.map((submission) => (
                        <tr
                          key={submission.id}
                          className="border-b border-neutral-800/50 last:border-0 hover:bg-neutral-800/30 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="font-medium text-white">
                              {submission.form_template?.name || "Formular"}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-sm text-neutral-400">
                            {formatDate(submission.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setViewingSubmission(submission)}
                                className="text-neutral-500 hover:text-white"
                                title="Ansehen"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteSubmission(submission.id)}
                                className="text-neutral-500 hover:text-red-400"
                                title="Löschen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

      {/* Modal: Partner Job */}
      <Modal
        open={showJobModal}
        onClose={() => { setShowJobModal(false); setEditingJob(null); }}
        title={editingJob ? "Job bearbeiten" : "Neuer Partner-Job"}
      >
        <form onSubmit={saveJob} className="space-y-4">
          <div>
            <label className="label">Titel *</label>
            <input
              type="text"
              className="input"
              value={jobForm.title}
              onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
              placeholder="z.B. DC-Montage Dachfläche"
              required
            />
          </div>

          <div>
            <label className="label">Gewerk *</label>
            <select
              className="input"
              value={jobForm.trade}
              onChange={(e) => setJobForm({ ...jobForm, trade: e.target.value })}
            >
              {tradeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">
              Nur Partner mit diesem Gewerk sehen den Job im Pool
            </p>
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <textarea
              className="input"
              rows={3}
              value={jobForm.description}
              onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
              placeholder="Details zum Auftrag, Besonderheiten, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Geplantes Datum</label>
              <input
                type="date"
                className="input"
                value={jobForm.scheduled_date}
                onChange={(e) => setJobForm({ ...jobForm, scheduled_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Deadline</label>
              <input
                type="date"
                className="input"
                value={jobForm.deadline}
                onChange={(e) => setJobForm({ ...jobForm, deadline: e.target.value })}
              />
            </div>
          </div>

          {editingJob && (
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={editingJob.status}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  await supabase.from("partner_jobs").update({ status: newStatus }).eq("id", editingJob.id);
                  setEditingJob({ ...editingJob, status: newStatus });
                  loadData();
                }}
              >
                <option value="open">Offen (im Pool)</option>
                <option value="accepted">Angenommen</option>
                <option value="in_progress">In Arbeit</option>
                <option value="completed">Abgeschlossen</option>
                <option value="cancelled">Abgebrochen</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowJobModal(false); setEditingJob(null); }} className="btn btn-ghost">
              Abbrechen
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Spinner /> : (editingJob ? "Speichern" : "Erstellen")}
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
          onClick={() => window.history.back()}
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
                onClick={() => window.history.back()}
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
                <Image
                  src={previewDoc.storage_url || ""}
                  alt={previewDoc.name}
                  width={1920}
                  height={1080}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : previewDoc.mime_type === "application/pdf" ? (
              <div className="h-full flex flex-col">
                {/* iframe PDF viewer (works on desktop, not on mobile Chrome) */}
                <iframe
                  src={previewDoc.storage_url || ""}
                  className="w-full flex-1 rounded-lg bg-white hidden md:block"
                  title={previewDoc.name}
                />
                {/* Mobile fallback */}
                <div className="flex-1 flex flex-col items-center justify-center md:hidden text-neutral-400">
                  <FileText className="w-20 h-20 mb-4 opacity-50" />
                  <p className="text-lg mb-2">{previewDoc.name}</p>
                  <p className="text-sm text-neutral-500 mb-6">PDF-Vorschau nicht auf Mobilgeräten verfügbar</p>
                  <div className="flex gap-3">
                    <a
                      href={previewDoc.storage_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-primary"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" /> PDF öffnen
                    </a>
                    <a
                      href={previewDoc.storage_url || "#"}
                      download={previewDoc.name}
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-secondary"
                    >
                      <Download className="w-4 h-4 mr-2" /> Download
                    </a>
                  </div>
                </div>
              </div>
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
            {filteredCustomers.map((c) => (
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
                      <Image
                        src={formData[field.id]}
                        alt="Foto"
                        width={400}
                        height={300}
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
                      <Image src={value as string} alt={field?.label || "Bild"} width={400} height={300} className="max-h-40 rounded border border-neutral-700 bg-white" />
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
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left py-2 px-4">Angebot</th>
                <th className="text-left py-2 px-4 w-28">Datum</th>
                <th className="text-right py-2 px-4 w-32">Betrag</th>
                <th className="text-left py-2 px-4 w-32">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const statusInfo = getStatusInfo(quote.status);
                const isExported = !!quote.lexware_quotation_id;
                
                return (
                  <tr 
                    key={quote.id} 
                    className="border-b border-neutral-800/50 last:border-0 transition-colors cursor-pointer hover:bg-neutral-800/30"
                    onClick={() => {
                      if (isExported) {
                        window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank");
                      } else {
                        router.push(`/quotes/${quote.id}`);
                      }
                    }}
                  >
                    {/* Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isExported && <FileText className="w-4 h-4 text-blue-400" />}
                        <div>
                          <p className="font-medium text-white hover:text-[#fa432a]">
                            {quote.package_title || quote.title}
                          </p>
                          <p className={`text-xs font-mono ${isExported ? "text-blue-400" : "text-neutral-500"}`}>
                            {quote.lexware_quote_number || quote.quote_number || `#${quote.id.slice(0, 6)}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-sm text-neutral-400">
                      {new Date(quote.quote_date).toLocaleDateString("de-DE")}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right">
                      <span className="font-semibold text-white">
                        {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusMenuId(statusMenuId === quote.id ? null : quote.id);
                        }}
                        className={`text-xs px-2 py-1 rounded ${statusInfo.bg} ${statusInfo.text}`}
                      >
                        {statusInfo.label}
                      </button>

                      {/* Status Menu */}
                      {statusMenuId === quote.id && (
                        <div 
                          ref={menuRef}
                          className="absolute right-0 top-full mt-1 z-[100] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 min-w-[140px]"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ tasks, projectId, users, partners, onRefresh }: {
  tasks: any[];
  projectId: string;
  users: any[];
  partners: { id: string; company_name: string }[];
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
    setAssignedSubId(task.assigned_partner_id || "");
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
      assigned_partner_id: assignedSubId || null,
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

    setSaving(false);

    if (error) {
      console.error("Error saving task:", error);
      alert(`Fehler beim Speichern: ${error.message}`);
      return;
    }

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

  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  
  const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "cancelled");
  const doneTasks = tasks.filter(t => t.status === "done");
  const overdueCount = tasks.filter(t => 
    t.due_date && new Date(t.due_date) < new Date() && t.status !== "done"
  ).length;

  const filteredTasks = tasks.filter(t => {
    if (filter === "open") return t.status !== "done" && t.status !== "cancelled";
    if (filter === "done") return t.status === "done";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header mit Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
            <button
              onClick={() => setFilter("open")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === "open" ? "bg-[#fa432a] text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Offen ({openTasks.length})
            </button>
            <button
              onClick={() => setFilter("done")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === "done" ? "bg-[#fa432a] text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Erledigt ({doneTasks.length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                filter === "all" ? "bg-[#fa432a] text-white" : "text-neutral-400 hover:text-white"
              }`}
            >
              Alle
            </button>
          </div>
          {overdueCount > 0 && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {overdueCount} überfällig
            </span>
          )}
        </div>
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
      ) : filteredTasks.length === 0 ? (
        <div className="card p-8 text-center text-neutral-500">
          <p>{filter === "open" ? "Keine offenen Aufgaben" : "Keine erledigten Aufgaben"}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-neutral-900/50">
                <th className="text-left py-2 px-4 w-10"></th>
                <th className="text-left py-2 px-4">Aufgabe</th>
                <th className="text-left py-2 px-4 w-28">Priorität</th>
                <th className="text-left py-2 px-4 w-28">Fällig</th>
                <th className="text-left py-2 px-4 w-36">Zugewiesen</th>
                <th className="text-left py-2 px-4 w-28">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                const isDone = task.status === "done";
                const priority = priorityOptions.find(p => p.key === task.priority);
                
                return (
                  <tr 
                    key={task.id} 
                    className={`border-b border-neutral-800/50 last:border-0 transition-colors ${
                      isDone ? "opacity-50" : "hover:bg-neutral-800/30"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isDone 
                            ? "border-green-500 bg-green-500/20 text-green-400" 
                            : "border-neutral-600 hover:border-[#fa432a]"
                        }`}
                      >
                        {isDone && <CheckCircle className="w-3 h-3" />}
                      </button>
                    </td>

                    {/* Task Info */}
                    <td className="py-3 px-4 cursor-pointer" onClick={() => openEdit(task)}>
                      <p className={`font-medium ${isDone ? "line-through text-neutral-500" : "text-white hover:text-[#fa432a]"}`}>
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded ${
                        task.priority === "urgent" ? "bg-red-500/20 text-red-400" :
                        task.priority === "high" ? "bg-orange-500/20 text-orange-400" :
                        task.priority === "low" ? "bg-neutral-500/10 text-neutral-500" :
                        "bg-neutral-500/10 text-neutral-400"
                      }`}>
                        {priority?.label || "Normal"}
                      </span>
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-4">
                      {task.due_date ? (
                        <span className={`text-sm flex items-center gap-1 ${
                          isOverdue ? "text-red-400" : "text-neutral-400"
                        }`}>
                          {isOverdue && <AlertCircle className="w-3 h-3" />}
                          {new Date(task.due_date).toLocaleDateString("de-DE")}
                        </span>
                      ) : (
                        <span className="text-neutral-600 text-sm">–</span>
                      )}
                    </td>

                    {/* Assigned */}
                    <td className="py-3 px-4">
                      <div className="text-xs space-y-0.5">
                        {task.assigned_user?.display_name && (
                          <p className="text-neutral-400">{task.assigned_user.display_name}</p>
                        )}
                        {task.assigned_partner?.company_name && (
                          <p className="text-[#fa432a]">{task.assigned_partner.company_name}</p>
                        )}
                        {!task.assigned_user?.display_name && !task.assigned_partner?.company_name && (
                          <span className="text-neutral-600">–</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <select
                        value={task.status}
                        onChange={async (e) => {
                          await supabase
                            .from("project_tasks")
                            .update({ 
                              status: e.target.value,
                              completed_at: e.target.value === "done" ? new Date().toISOString() : null,
                              updated_at: new Date().toISOString()
                            })
                            .eq("id", task.id);
                          onRefresh();
                        }}
                        className="bg-neutral-800 border border-neutral-700 text-neutral-300 rounded px-2 py-1 text-xs w-full"
                      >
                        {statusOptions.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Delete */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              <label className="form-label">Partner</label>
              <select className="input" value={assignedSubId} onChange={(e) => setAssignedSubId(e.target.value)}>
                <option value="">Nicht zugewiesen</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
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
