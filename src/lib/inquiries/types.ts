export interface InquiryTemplateField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "checkbox" | "photo";
  options?: string[];
  required?: boolean;
  group?: string;
}

export interface InquiryTemplate {
  id: string;
  trade: string;
  name: string;
  description: string | null;
  fields: InquiryTemplateField[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type InquiryStatus = "draft" | "sent" | "in_review" | "answered" | "accepted" | "declined" | "closed";
export type InquiryMode = "direct" | "tender";
export type InquiryUrgency = "low" | "normal" | "high" | "urgent";

export interface Inquiry {
  id: string;
  project_id: string | null;
  template_id: string | null;
  title: string;
  description: string | null;
  trade: string;
  urgency: InquiryUrgency;
  location_notes: string | null;
  checklist_data: Record<string, any>;
  photos: string[];
  status: InquiryStatus;
  mode: InquiryMode;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  project?: { id: string; name: string } | null;
  recipients?: InquiryRecipient[];
  responses?: InquiryResponse[];
}

export type RecipientStatus = "pending" | "viewed" | "responded" | "accepted" | "declined";

export interface InquiryRecipient {
  id: string;
  inquiry_id: string;
  partner_id: string;
  status: RecipientStatus;
  viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  partner?: { id: string; company_name: string; trade: string };
}

export type ResponseType = "quick" | "detailed";

export interface ResponsePosition {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  category: "material" | "labor" | "travel" | "other";
}

export interface InquiryResponse {
  id: string;
  inquiry_id: string;
  partner_id: string;
  response_type: ResponseType;
  quick_text: string | null;
  quick_price: number | null;
  quick_timeframe: string | null;
  positions: ResponsePosition[];
  total_amount: number | null;
  notes: string | null;
  valid_until: string | null;
  status: "draft" | "submitted";
  created_at: string;
  updated_at: string;
  partner?: { id: string; company_name: string };
}

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  sender_type: "staff" | "partner";
  sender_id: string;
  sender_name: string;
  message: string;
  attachments: { url: string; name: string; type: string }[];
  created_at: string;
  read_at: string | null;
}
