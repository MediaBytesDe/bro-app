/**
 * Dashboard API client for customer portal data.
 * All portal data is fetched from https://dashboard.brojekt.gmbh/api/portal/
 */

const DASHBOARD_API = process.env.NEXT_PUBLIC_DASHBOARD_API_URL || 'https://dashboard.brojekt.gmbh/api/portal';

export class DashboardPortalAPI {
  private token: string | null = null;

  constructor(token?: string) {
    this.token = token || null;
  }

  private get headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) h['Authorization'] = `Bearer ${this.token}`;
    return h;
  }

  setToken(token: string) {
    this.token = token;
  }

  // ─── Auth ───
  async login(email: string, password: string): Promise<{ token: string; customer: PortalCustomer }> {
    const res = await fetch(`${DASHBOARD_API}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Login fehlgeschlagen');
    }
    return res.json();
  }

  // ─── Projects ───
  async getProjects(): Promise<PortalProject[]> {
    const res = await fetch(`${DASHBOARD_API}/projects`, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  // ─── Offers ───
  async getOffers(): Promise<PortalOffer[]> {
    const res = await fetch(`${DASHBOARD_API}/offers`, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  async respondToOffer(id: number, status: 'accepted' | 'rejected'): Promise<PortalOffer> {
    const res = await fetch(`${DASHBOARD_API}/offers/${id}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Fehler beim Antworten');
    return res.json();
  }

  // ─── Documents ───
  async getDocuments(): Promise<PortalDocument[]> {
    const res = await fetch(`${DASHBOARD_API}/documents`, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  // ─── Messages ───
  async getMessages(): Promise<PortalMessage[]> {
    const res = await fetch(`${DASHBOARD_API}/messages`, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }

  async sendMessage(content: string): Promise<PortalMessage> {
    const res = await fetch(`${DASHBOARD_API}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Nachricht konnte nicht gesendet werden');
    return res.json();
  }

  // ─── Appointments ───
  async getAppointments(): Promise<PortalAppointment[]> {
    const res = await fetch(`${DASHBOARD_API}/appointments`, { headers: this.headers });
    if (!res.ok) return [];
    return res.json();
  }
}

// ─── Types ───

export interface PortalCustomer {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
}

export interface PortalProject {
  id: number;
  name: string;
  description?: string;
  status: string;
  sizeKwp?: number;
  totalPrice?: number;
  address?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  offers?: PortalOffer[];
  documents?: PortalDocument[];
  payments?: PortalPayment[];
}

export interface PortalOffer {
  id: number;
  title: string;
  description?: string;
  totalPrice: number;
  status: string;
  validUntil?: string;
  pdfUrl?: string;
  respondedAt?: string;
  createdAt: string;
  project?: PortalProject;
}

export interface PortalDocument {
  id: number;
  name: string;
  type: string;
  fileUrl: string;
  size?: number;
  mimeType?: string;
  createdAt: string;
}

export interface PortalMessage {
  id: number;
  content: string;
  fromCustomer: boolean;
  read: boolean;
  createdAt: string;
}

export interface PortalAppointment {
  id: number;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  location?: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface PortalPayment {
  id: number;
  title: string;
  amount: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
}

// Singleton with token from localStorage
let _instance: DashboardPortalAPI | null = null;

export function getPortalAPI(): DashboardPortalAPI {
  if (!_instance) {
    _instance = new DashboardPortalAPI();
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('portal-token');
      if (token) _instance.setToken(token);
    }
  }
  return _instance;
}

export function setPortalToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('portal-token', token);
  }
  getPortalAPI().setToken(token);
}

export function clearPortalToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('portal-token');
  }
  _instance = null;
}
