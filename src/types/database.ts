/**
 * BROjekt Database Types
 * Auto-generated TypeScript types for Supabase
 * Generated: 2026-02-02
 */

// ============================================================================
// ENUM TYPES
// ============================================================================

export type AppointmentStatus = 
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

export type AppointmentType = 
  | 'aufmass'
  | 'vob_termin'
  | 'montage_start'
  | 'montage_end'
  | 'abnahme'
  | 'nachbesserung'
  | 'wartung'
  | 'beratung'
  | 'sonstiges';

export type CustomerStatus = 
  | 'active'
  | 'inactive'
  | 'blocked';

export type CustomerType = 
  | 'private'
  | 'business'
  | 'public';

export type DocumentType = 
  | 'vertrag'
  | 'angebot'
  | 'rechnung'
  | 'aufmass'
  | 'plan'
  | 'foto'
  | 'protokoll'
  | 'unterschrift'
  | 'datenschutz'
  | 'sonstiges';

export type FormStatus = 
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type LeadStatus = 
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type QuoteStatus = 
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'revised';

export type ReportType = 
  | 'daily'
  | 'material'
  | 'issue'
  | 'progress'
  | 'handover'
  | 'acceptance';

export type SubcontractorStatus = 
  | 'active'
  | 'inactive'
  | 'blacklisted'
  | 'pending';

export type TaskStatus = 
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'done';

export type TradeType = 
  | 'elektriker'
  | 'dachdecker'
  | 'sanitaer'
  | 'heizung'
  | 'klima'
  | 'maler'
  | 'trockenbau'
  | 'geruestbau'
  | 'tiefbau'
  | 'zimmerer'
  | 'sonstige';

export type UserRole = 
  | 'admin'
  | 'user'
  | 'viewer'
  | 'mitarbeiter'
  | 'subcontractor'
  | 'customer';

// ============================================================================
// JSON TYPES (for JSONB fields)
// ============================================================================

export interface QuoteLineItem {
  id: string;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

export interface ReportWorker {
  user_id?: string;
  name: string;
  role?: string;
  hours: number;
}

export interface ReportMaterial {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'radio' | 'signature' | 'photo' | 'heading' | 'divider';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
  defaultValue?: unknown;
}

export interface FormLayout {
  columns?: number;
  sections?: { title: string; fields: string[] }[];
}

// ============================================================================
// TABLE TYPES
// ============================================================================

// --- PROJECTS ---
export interface WorkfolderStatusDef {
  key: string;
  label: string;
  color: string;
  sort: number;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number | null;
  parent_id: string | null;    // NULL = Top-Level (Marke), UUID = Arbeitsmappe
  customer_id: string | null;  // Link to customer (für Arbeitsmappen)
  workfolder_status: string | null;        // Aktueller Status der Arbeitsmappe
  workfolder_statuses: WorkfolderStatusDef[] | null;  // Status-Definitionen (nur bei Marken)
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectInsert {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number | null;
  parent_id?: string | null;
  customer_id?: string | null;
  workfolder_status?: string | null;
  workfolder_statuses?: WorkfolderStatusDef[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectUpdate {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number | null;
  parent_id?: string | null;
  customer_id?: string | null;
  workfolder_status?: string | null;
  workfolder_statuses?: WorkfolderStatusDef[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- CATEGORIES ---
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  project_id: string | null;
  sort_order: number | null;
  created_at: string | null;
}

export interface CategoryInsert {
  id?: string;
  name: string;
  slug: string;
  project_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface CategoryUpdate {
  id?: string;
  name?: string;
  slug?: string;
  project_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

// --- TASKS ---
export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: string | null;
  project_id: string | null;
  category_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  skill: string | null;
  type: string | null;
  run_requested_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TaskInsert {
  id?: string;
  title: string;
  description?: string | null;
  status?: TaskStatus | null;
  priority?: string | null;
  project_id?: string | null;
  category_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  skill?: string | null;
  type?: string | null;
  run_requested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskUpdate {
  id?: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus | null;
  priority?: string | null;
  project_id?: string | null;
  category_id?: string | null;
  assigned_to?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  skill?: string | null;
  type?: string | null;
  run_requested_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- LEADS ---
export interface LeadRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: LeadStatus | null;
  notes: string | null;
  assigned_to: string | null;
  value: number | null;
  email_status: string | null;
  email_draft: string | null;
  email_subject: string | null;
  email_sent_at: string | null;
  customer_id: string | null;  // Link to converted customer
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadInsert {
  id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: LeadStatus | null;
  notes?: string | null;
  assigned_to?: string | null;
  value?: number | null;
  email_status?: string | null;
  email_draft?: string | null;
  email_subject?: string | null;
  email_sent_at?: string | null;
  customer_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface LeadUpdate {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source?: string | null;
  status?: LeadStatus | null;
  notes?: string | null;
  assigned_to?: string | null;
  value?: number | null;
  email_status?: string | null;
  email_draft?: string | null;
  email_subject?: string | null;
  email_sent_at?: string | null;
  customer_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- SKILLS ---
export interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  trigger: string | null;
  steps: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SkillInsert {
  id?: string;
  name: string;
  description?: string | null;
  trigger?: string | null;
  steps?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SkillUpdate {
  id?: string;
  name?: string;
  description?: string | null;
  trigger?: string | null;
  steps?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- USERS ---
export interface UserRow {
  id: string;
  auth_id: string | null;
  username: string;
  display_name: string | null;
  email: string | null;
  role: UserRole | null;
  avatar: string | null;
  active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface UserInsert {
  id?: string;
  auth_id?: string | null;
  username: string;
  display_name?: string | null;
  email?: string | null;
  role?: UserRole | null;
  avatar?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UserUpdate {
  id?: string;
  auth_id?: string | null;
  username?: string;
  display_name?: string | null;
  email?: string | null;
  role?: UserRole | null;
  avatar?: string | null;
  active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- LOGS ---
export interface LogRow {
  id: string;
  type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string | null;
}

export interface LogInsert {
  id?: string;
  type: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  user_id?: string | null;
  created_at?: string | null;
}

export interface LogUpdate {
  id?: string;
  type?: string;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  user_id?: string | null;
  created_at?: string | null;
}

// --- CUSTOMERS ---
export interface CustomerRow {
  id: string;
  lead_id: string | null;
  lexware_id: string | null;
  lexware_sync_at: string | null;
  customer_number: string | null;
  customer_type: CustomerType | null;
  status: CustomerStatus | null;
  company_name: string | null;
  salutation: string | null;
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  billing_street: string | null;
  billing_house_number: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
  tax_id: string | null;
  notes: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CustomerInsert {
  id?: string;
  lead_id?: string | null;
  lexware_id?: string | null;
  lexware_sync_at?: string | null;
  customer_number?: string | null;
  customer_type?: CustomerType | null;
  status?: CustomerStatus | null;
  company_name?: string | null;
  salutation?: string | null;
  first_name?: string | null;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  billing_street?: string | null;
  billing_house_number?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CustomerUpdate {
  id?: string;
  lead_id?: string | null;
  lexware_id?: string | null;
  lexware_sync_at?: string | null;
  customer_number?: string | null;
  customer_type?: CustomerType | null;
  status?: CustomerStatus | null;
  company_name?: string | null;
  salutation?: string | null;
  first_name?: string | null;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  billing_street?: string | null;
  billing_house_number?: string | null;
  billing_postal_code?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  assigned_to?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- QUOTES ---
export interface QuoteRow {
  id: string;
  customer_id: string;
  project_id: string | null;
  lead_id: string | null;
  lexware_quote_id: string | null;
  lexware_sync_at: string | null;
  quote_number: string;
  title: string;
  description: string | null;
  status: QuoteStatus | null;
  net_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  gross_amount: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  line_items: QuoteLineItem[] | null;
  valid_until: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface QuoteInsert {
  id?: string;
  customer_id: string;
  project_id?: string | null;
  lead_id?: string | null;
  lexware_quote_id?: string | null;
  lexware_sync_at?: string | null;
  quote_number: string;
  title: string;
  description?: string | null;
  status?: QuoteStatus | null;
  net_amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  gross_amount?: number | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  line_items?: QuoteLineItem[] | null;
  valid_until?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  pdf_url?: string | null;
  pdf_generated_at?: string | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface QuoteUpdate {
  id?: string;
  customer_id?: string;
  project_id?: string | null;
  lead_id?: string | null;
  lexware_quote_id?: string | null;
  lexware_sync_at?: string | null;
  quote_number?: string;
  title?: string;
  description?: string | null;
  status?: QuoteStatus | null;
  net_amount?: number | null;
  tax_rate?: number | null;
  tax_amount?: number | null;
  gross_amount?: number | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  line_items?: QuoteLineItem[] | null;
  valid_until?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  pdf_url?: string | null;
  pdf_generated_at?: string | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- SUBCONTRACTORS ---
export interface SubcontractorRow {
  id: string;
  company_name: string;
  trade: TradeType;
  trades: TradeType[] | null;
  status: SubcontractorStatus | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_mobile: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  trade_license: string | null;
  insurance_valid_until: string | null;
  rating: number | null;
  rating_count: number | null;
  hourly_rate: number | null;
  payment_terms: number | null;
  notes: string | null;
  tags: string[] | null;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SubcontractorInsert {
  id?: string;
  company_name: string;
  trade: TradeType;
  trades?: TradeType[] | null;
  status?: SubcontractorStatus | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_mobile?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  trade_license?: string | null;
  insurance_valid_until?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  hourly_rate?: number | null;
  payment_terms?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SubcontractorUpdate {
  id?: string;
  company_name?: string;
  trade?: TradeType;
  trades?: TradeType[] | null;
  status?: SubcontractorStatus | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_mobile?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  tax_id?: string | null;
  trade_license?: string | null;
  insurance_valid_until?: string | null;
  rating?: number | null;
  rating_count?: number | null;
  hourly_rate?: number | null;
  payment_terms?: number | null;
  notes?: string | null;
  tags?: string[] | null;
  user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- PROJECT_SUBCONTRACTORS ---
export interface ProjectSubcontractorRow {
  id: string;
  project_id: string;
  subcontractor_id: string;
  trade: TradeType;
  scope: string | null;
  agreed_amount: number | null;
  actual_amount: number | null;
  payment_status: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  project_rating: number | null;
  project_feedback: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectSubcontractorInsert {
  id?: string;
  project_id: string;
  subcontractor_id: string;
  trade: TradeType;
  scope?: string | null;
  agreed_amount?: number | null;
  actual_amount?: number | null;
  payment_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  project_rating?: number | null;
  project_feedback?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProjectSubcontractorUpdate {
  id?: string;
  project_id?: string;
  subcontractor_id?: string;
  trade?: TradeType;
  scope?: string | null;
  agreed_amount?: number | null;
  actual_amount?: number | null;
  payment_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  project_rating?: number | null;
  project_feedback?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- APPOINTMENTS ---
export interface AppointmentRow {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  quote_id: string | null;
  title: string;
  description: string | null;
  appointment_type: AppointmentType;
  status: AppointmentStatus | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean | null;
  location_type: string | null;
  location_address: string | null;
  location_notes: string | null;
  assigned_to: string[] | null;
  subcontractor_ids: string[] | null;
  reminder_sent: boolean | null;
  reminder_minutes: number | null;
  completed_at: string | null;
  outcome: string | null;
  follow_up_required: boolean | null;
  follow_up_notes: string | null;
  external_calendar_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AppointmentInsert {
  id?: string;
  project_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  quote_id?: string | null;
  title: string;
  description?: string | null;
  appointment_type: AppointmentType;
  status?: AppointmentStatus | null;
  start_time: string;
  end_time?: string | null;
  all_day?: boolean | null;
  location_type?: string | null;
  location_address?: string | null;
  location_notes?: string | null;
  assigned_to?: string[] | null;
  subcontractor_ids?: string[] | null;
  reminder_sent?: boolean | null;
  reminder_minutes?: number | null;
  completed_at?: string | null;
  outcome?: string | null;
  follow_up_required?: boolean | null;
  follow_up_notes?: string | null;
  external_calendar_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AppointmentUpdate {
  id?: string;
  project_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  quote_id?: string | null;
  title?: string;
  description?: string | null;
  appointment_type?: AppointmentType;
  status?: AppointmentStatus | null;
  start_time?: string;
  end_time?: string | null;
  all_day?: boolean | null;
  location_type?: string | null;
  location_address?: string | null;
  location_notes?: string | null;
  assigned_to?: string[] | null;
  subcontractor_ids?: string[] | null;
  reminder_sent?: boolean | null;
  reminder_minutes?: number | null;
  completed_at?: string | null;
  outcome?: string | null;
  follow_up_required?: boolean | null;
  follow_up_notes?: string | null;
  external_calendar_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- REPORTS ---
export interface ReportRow {
  id: string;
  project_id: string;
  appointment_id: string | null;
  report_number: string | null;
  report_type: ReportType;
  title: string;
  report_date: string;
  work_start: string | null;
  work_end: string | null;
  break_minutes: number | null;
  workers: ReportWorker[] | null;
  materials: ReportMaterial[] | null;
  description: string | null;
  work_performed: string | null;
  issues: string | null;
  next_steps: string | null;
  weather: string | null;
  temperature: number | null;
  status: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  worker_signature_id: string | null;
  customer_signature_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReportInsert {
  id?: string;
  project_id: string;
  appointment_id?: string | null;
  report_number?: string | null;
  report_type: ReportType;
  title: string;
  report_date?: string;
  work_start?: string | null;
  work_end?: string | null;
  break_minutes?: number | null;
  workers?: ReportWorker[] | null;
  materials?: ReportMaterial[] | null;
  description?: string | null;
  work_performed?: string | null;
  issues?: string | null;
  next_steps?: string | null;
  weather?: string | null;
  temperature?: number | null;
  status?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  worker_signature_id?: string | null;
  customer_signature_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReportUpdate {
  id?: string;
  project_id?: string;
  appointment_id?: string | null;
  report_number?: string | null;
  report_type?: ReportType;
  title?: string;
  report_date?: string;
  work_start?: string | null;
  work_end?: string | null;
  break_minutes?: number | null;
  workers?: ReportWorker[] | null;
  materials?: ReportMaterial[] | null;
  description?: string | null;
  work_performed?: string | null;
  issues?: string | null;
  next_steps?: string | null;
  weather?: string | null;
  temperature?: number | null;
  status?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  worker_signature_id?: string | null;
  customer_signature_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- DOCUMENTS ---
export interface DocumentRow {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  quote_id: string | null;
  report_id: string | null;
  appointment_id: string | null;
  document_type: DocumentType;
  name: string;
  description: string | null;
  storage_type: string | null;
  storage_path: string;
  storage_url: string | null;
  onedrive_item_id: string | null;
  onedrive_drive_id: string | null;
  onedrive_web_url: string | null;
  file_name: string;
  file_extension: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_signature: boolean | null;
  signed_by: string | null;
  signed_at: string | null;
  signature_ip: string | null;
  version: number | null;
  parent_document_id: string | null;
  uploaded_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface DocumentInsert {
  id?: string;
  project_id?: string | null;
  customer_id?: string | null;
  quote_id?: string | null;
  report_id?: string | null;
  appointment_id?: string | null;
  document_type: DocumentType;
  name: string;
  description?: string | null;
  storage_type?: string | null;
  storage_path: string;
  storage_url?: string | null;
  onedrive_item_id?: string | null;
  onedrive_drive_id?: string | null;
  onedrive_web_url?: string | null;
  file_name: string;
  file_extension?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  is_signature?: boolean | null;
  signed_by?: string | null;
  signed_at?: string | null;
  signature_ip?: string | null;
  version?: number | null;
  parent_document_id?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DocumentUpdate {
  id?: string;
  project_id?: string | null;
  customer_id?: string | null;
  quote_id?: string | null;
  report_id?: string | null;
  appointment_id?: string | null;
  document_type?: DocumentType;
  name?: string;
  description?: string | null;
  storage_type?: string | null;
  storage_path?: string;
  storage_url?: string | null;
  onedrive_item_id?: string | null;
  onedrive_drive_id?: string | null;
  onedrive_web_url?: string | null;
  file_name?: string;
  file_extension?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  is_signature?: boolean | null;
  signed_by?: string | null;
  signed_at?: string | null;
  signature_ip?: string | null;
  version?: number | null;
  parent_document_id?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- FORM_TEMPLATES ---
export interface FormTemplateRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  fields: FormField[];
  layout: FormLayout | null;
  requires_signature: boolean | null;
  requires_customer_email: boolean | null;
  send_confirmation_email: boolean | null;
  active: boolean | null;
  version: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FormTemplateInsert {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  fields?: FormField[];
  layout?: FormLayout | null;
  requires_signature?: boolean | null;
  requires_customer_email?: boolean | null;
  send_confirmation_email?: boolean | null;
  active?: boolean | null;
  version?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FormTemplateUpdate {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  category?: string | null;
  fields?: FormField[];
  layout?: FormLayout | null;
  requires_signature?: boolean | null;
  requires_customer_email?: boolean | null;
  send_confirmation_email?: boolean | null;
  active?: boolean | null;
  version?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// --- FORM_SUBMISSIONS ---
export interface FormSubmissionRow {
  id: string;
  template_id: string;
  project_id: string | null;
  customer_id: string | null;
  lead_id: string | null;
  appointment_id: string | null;
  data: Record<string, unknown>;
  status: FormStatus | null;
  signature_document_id: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_by_email: string | null;
  submitted_ip: string | null;
  submitted_user_agent: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FormSubmissionInsert {
  id?: string;
  template_id: string;
  project_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  appointment_id?: string | null;
  data?: Record<string, unknown>;
  status?: FormStatus | null;
  signature_document_id?: string | null;
  signed_at?: string | null;
  signed_by_name?: string | null;
  signed_by_email?: string | null;
  submitted_ip?: string | null;
  submitted_user_agent?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FormSubmissionUpdate {
  id?: string;
  template_id?: string;
  project_id?: string | null;
  customer_id?: string | null;
  lead_id?: string | null;
  appointment_id?: string | null;
  data?: Record<string, unknown>;
  status?: FormStatus | null;
  signature_document_id?: string | null;
  signed_at?: string | null;
  signed_by_name?: string | null;
  signed_by_email?: string | null;
  submitted_ip?: string | null;
  submitted_user_agent?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// ============================================================================
// DATABASE TYPE (for Supabase Client)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      categories: {
        Row: CategoryRow;
        Insert: CategoryInsert;
        Update: CategoryUpdate;
      };
      tasks: {
        Row: TaskRow;
        Insert: TaskInsert;
        Update: TaskUpdate;
      };
      leads: {
        Row: LeadRow;
        Insert: LeadInsert;
        Update: LeadUpdate;
      };
      skills: {
        Row: SkillRow;
        Insert: SkillInsert;
        Update: SkillUpdate;
      };
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      logs: {
        Row: LogRow;
        Insert: LogInsert;
        Update: LogUpdate;
      };
      customers: {
        Row: CustomerRow;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
      };
      quotes: {
        Row: QuoteRow;
        Insert: QuoteInsert;
        Update: QuoteUpdate;
      };
      subcontractors: {
        Row: SubcontractorRow;
        Insert: SubcontractorInsert;
        Update: SubcontractorUpdate;
      };
      project_subcontractors: {
        Row: ProjectSubcontractorRow;
        Insert: ProjectSubcontractorInsert;
        Update: ProjectSubcontractorUpdate;
      };
      appointments: {
        Row: AppointmentRow;
        Insert: AppointmentInsert;
        Update: AppointmentUpdate;
      };
      reports: {
        Row: ReportRow;
        Insert: ReportInsert;
        Update: ReportUpdate;
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
      };
      form_templates: {
        Row: FormTemplateRow;
        Insert: FormTemplateInsert;
        Update: FormTemplateUpdate;
      };
      form_submissions: {
        Row: FormSubmissionRow;
        Insert: FormSubmissionInsert;
        Update: FormSubmissionUpdate;
      };
    };
    Enums: {
      appointment_status: AppointmentStatus;
      appointment_type: AppointmentType;
      customer_status: CustomerStatus;
      customer_type: CustomerType;
      document_type: DocumentType;
      form_status: FormStatus;
      lead_status: LeadStatus;
      quote_status: QuoteStatus;
      report_type: ReportType;
      subcontractor_status: SubcontractorStatus;
      task_status: TaskStatus;
      trade_type: TradeType;
      user_role: UserRole;
    };
  };
}

// ============================================================================
// TYPE ALIASES (Convenience Exports)
// ============================================================================

// Row Types (für SELECT Queries)
export type Project = ProjectRow;
export type Category = CategoryRow;
export type Task = TaskRow;
export type Lead = LeadRow;
export type Skill = SkillRow;
export type User = UserRow;
export type Log = LogRow;
export type Customer = CustomerRow;
export type Quote = QuoteRow;
export type Subcontractor = SubcontractorRow;
export type ProjectSubcontractor = ProjectSubcontractorRow;
export type Appointment = AppointmentRow;
export type Report = ReportRow;
export type Document = DocumentRow;
export type FormTemplate = FormTemplateRow;
export type FormSubmission = FormSubmissionRow;

// Insert Types (für INSERT Queries)
export type NewProject = ProjectInsert;
export type NewCategory = CategoryInsert;
export type NewTask = TaskInsert;
export type NewLead = LeadInsert;
export type NewSkill = SkillInsert;
export type NewUser = UserInsert;
export type NewLog = LogInsert;
export type NewCustomer = CustomerInsert;
export type NewQuote = QuoteInsert;
export type NewSubcontractor = SubcontractorInsert;
export type NewProjectSubcontractor = ProjectSubcontractorInsert;
export type NewAppointment = AppointmentInsert;
export type NewReport = ReportInsert;
export type NewDocument = DocumentInsert;
export type NewFormTemplate = FormTemplateInsert;
export type NewFormSubmission = FormSubmissionInsert;

// ============================================================================
// UTILITY TYPES
// ============================================================================

/** Extract table names from Database type */
export type TableName = keyof Database['public']['Tables'];

/** Extract Row type for a given table */
export type TableRow<T extends TableName> = Database['public']['Tables'][T]['Row'];

/** Extract Insert type for a given table */
export type TableInsert<T extends TableName> = Database['public']['Tables'][T]['Insert'];

/** Extract Update type for a given table */
export type TableUpdate<T extends TableName> = Database['public']['Tables'][T]['Update'];

/** Extract enum names from Database type */
export type EnumName = keyof Database['public']['Enums'];

/** Extract enum values for a given enum */
export type EnumValue<T extends EnumName> = Database['public']['Enums'][T];

// ============================================================================
// EXTENDED TYPES (with computed fields)
// ============================================================================

/** Project with task statistics (for dashboard) */
export interface ProjectStats extends ProjectRow {
  total_tasks: number;
  open_tasks: number;
  in_progress_tasks: number;
  done_tasks: number;
}

/** Task with category info */
export interface TaskWithCategory extends TaskRow {
  category?: { name: string } | null;
}
