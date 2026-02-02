/**
 * Lexware API Client
 * 
 * Handles all communication with the Lexware (lexoffice) API.
 * Rate limit: 2 requests/second (Token Bucket)
 * 
 * @see https://developers.lexware.io/docs/
 */

// Types
export interface LexwareContact {
  id?: string;
  version: number;
  roles: {
    customer?: Record<string, never>;
    vendor?: Record<string, never>;
  };
  company?: {
    name: string;
    taxNumber?: string;
    vatRegistrationId?: string;
    contactPersons?: LexwareContactPerson[];
  };
  person?: {
    salutation?: string;
    firstName?: string;
    lastName: string;
  };
  addresses?: {
    billing?: LexwareAddress[];
    shipping?: LexwareAddress[];
  };
  emailAddresses?: {
    business?: string[];
    private?: string[];
  };
  phoneNumbers?: {
    business?: string[];
    mobile?: string[];
    private?: string[];
  };
  note?: string;
  archived?: boolean;
}

export interface LexwareContactPerson {
  salutation?: string;
  firstName?: string;
  lastName: string;
  primary?: boolean;
  emailAddress?: string;
  phoneNumber?: string;
}

export interface LexwareAddress {
  street?: string;
  supplement?: string;
  zip?: string;
  city?: string;
  countryCode: string; // ISO 3166-2 (e.g., "DE")
}

export interface LexwareQuotation {
  id?: string;
  version?: number;
  voucherDate: string; // YYYY-MM-DD
  expirationDate?: string;
  address: {
    contactId: string;
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
    countryCode?: string;
  };
  lineItems: LexwareLineItem[];
  totalPrice?: {
    currency?: string;
    totalNetAmount?: number;
    totalGrossAmount?: number;
    totalTaxAmount?: number;
  };
  taxConditions: {
    taxType: "net" | "gross" | "vatfree";
  };
  paymentConditions?: {
    paymentTermLabel?: string;
    paymentTermDuration?: number;
  };
  introduction?: string;
  remark?: string;
  title?: string;
}

export interface LexwareLineItem {
  type: "custom" | "text";
  name: string;
  description?: string;
  quantity?: number;
  unitName?: string;
  unitPrice?: {
    currency: string;
    netAmount?: number;
    grossAmount?: number;
    taxRatePercentage?: number;
  };
}

export interface LexwareInvoice extends LexwareQuotation {
  // Same structure as quotation, with additional fields
  shippingConditions?: {
    shippingDate?: string;
    shippingType?: "delivery" | "service" | "deliveryperiod" | "serviceperiod";
  };
}

// API Response Types
interface LexwarePaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  page: number;
  size: number;
}

interface LexwareErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}

// Rate limiter (2 req/sec = 500ms between requests)
class RateLimiter {
  private lastRequest = 0;
  private readonly minInterval = 500; // ms

  async wait(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
  }
}

// Client class
export class LexwareClient {
  private readonly baseUrl = "https://api.lexoffice.io";
  private readonly apiKey: string;
  private readonly rateLimiter = new RateLimiter();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.LEXWARE_API_KEY || "";
    
    if (!this.apiKey) {
      console.warn("LexwareClient: No API key provided. Set LEXWARE_API_KEY env var.");
    }
  }

  // Generic request method
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    await this.rateLimiter.wait();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json() as LexwareErrorResponse;
      throw new LexwareError(error.message, error.status, error);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  // ============================================================================
  // CONTACTS
  // ============================================================================

  /**
   * Create a new contact (customer/vendor)
   */
  async createContact(contact: Omit<LexwareContact, "id">): Promise<{ id: string }> {
    return this.request<{ id: string }>("POST", "/v1/contacts", contact);
  }

  /**
   * Get a contact by ID
   */
  async getContact(id: string): Promise<LexwareContact> {
    return this.request<LexwareContact>("GET", `/v1/contacts/${id}`);
  }

  /**
   * Update a contact
   */
  async updateContact(id: string, contact: LexwareContact): Promise<{ id: string }> {
    return this.request<{ id: string }>("PUT", `/v1/contacts/${id}`, contact);
  }

  /**
   * List all contacts with pagination
   */
  async listContacts(options?: {
    page?: number;
    size?: number;
    customer?: boolean;
    vendor?: boolean;
    email?: string;
  }): Promise<LexwarePaginatedResponse<LexwareContact>> {
    const params = new URLSearchParams();
    if (options?.page !== undefined) params.set("page", options.page.toString());
    if (options?.size !== undefined) params.set("size", options.size.toString());
    if (options?.customer) params.set("customer", "true");
    if (options?.vendor) params.set("vendor", "true");
    if (options?.email) params.set("email", options.email);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<LexwarePaginatedResponse<LexwareContact>>("GET", `/v1/contacts${query}`);
  }

  // ============================================================================
  // QUOTATIONS (Angebote)
  // ============================================================================

  /**
   * Create a quotation
   */
  async createQuotation(quotation: LexwareQuotation): Promise<{ id: string }> {
    return this.request<{ id: string }>("POST", "/v1/quotations", quotation);
  }

  /**
   * Get a quotation by ID
   */
  async getQuotation(id: string): Promise<LexwareQuotation> {
    return this.request<LexwareQuotation>("GET", `/v1/quotations/${id}`);
  }

  /**
   * List quotations
   */
  async listQuotations(options?: {
    page?: number;
    size?: number;
  }): Promise<LexwarePaginatedResponse<LexwareQuotation>> {
    const params = new URLSearchParams();
    if (options?.page !== undefined) params.set("page", options.page.toString());
    if (options?.size !== undefined) params.set("size", options.size.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<LexwarePaginatedResponse<LexwareQuotation>>("GET", `/v1/quotations${query}`);
  }

  // ============================================================================
  // INVOICES (Rechnungen)
  // ============================================================================

  /**
   * Create an invoice
   */
  async createInvoice(invoice: LexwareInvoice): Promise<{ id: string }> {
    return this.request<{ id: string }>("POST", "/v1/invoices", invoice);
  }

  /**
   * Get an invoice by ID
   */
  async getInvoice(id: string): Promise<LexwareInvoice> {
    return this.request<LexwareInvoice>("GET", `/v1/invoices/${id}`);
  }

  /**
   * List invoices
   */
  async listInvoices(options?: {
    page?: number;
    size?: number;
  }): Promise<LexwarePaginatedResponse<LexwareInvoice>> {
    const params = new URLSearchParams();
    if (options?.page !== undefined) params.set("page", options.page.toString());
    if (options?.size !== undefined) params.set("size", options.size.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<LexwarePaginatedResponse<LexwareInvoice>>("GET", `/v1/invoices${query}`);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Convert BROjekt Customer to Lexware Contact format
   */
  static customerToContact(customer: {
    company_name?: string | null;
    first_name?: string | null;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    customer_type: "private" | "business" | "public";
    tax_id?: string | null;
    vat_id?: string | null;
    notes?: string | null;
  }): Omit<LexwareContact, "id"> {
    const isCompany = customer.customer_type === "business" || !!customer.company_name;

    return {
      version: 0,
      roles: { customer: {} },
      ...(isCompany
        ? {
            company: {
              name: customer.company_name || `${customer.first_name || ""} ${customer.last_name}`.trim(),
              taxNumber: customer.tax_id || undefined,
              vatRegistrationId: customer.vat_id || undefined,
              contactPersons: customer.first_name
                ? [
                    {
                      firstName: customer.first_name,
                      lastName: customer.last_name,
                      primary: true,
                      emailAddress: customer.email || undefined,
                      phoneNumber: customer.phone || undefined,
                    },
                  ]
                : undefined,
            },
          }
        : {
            person: {
              firstName: customer.first_name || undefined,
              lastName: customer.last_name,
            },
          }),
      addresses:
        customer.street || customer.city
          ? {
              billing: [
                {
                  street: customer.street || undefined,
                  zip: customer.zip || undefined,
                  city: customer.city || undefined,
                  countryCode: customer.country === "Deutschland" ? "DE" : customer.country || "DE",
                },
              ],
            }
          : undefined,
      emailAddresses: customer.email ? { business: [customer.email] } : undefined,
      phoneNumbers: {
        ...(customer.phone ? { business: [customer.phone] } : {}),
        ...(customer.mobile ? { mobile: [customer.mobile] } : {}),
      },
      note: customer.notes || undefined,
    };
  }

  /**
   * Convert BROjekt Quote to Lexware Quotation format
   */
  static quoteToQuotation(
    quote: {
      line_items: Array<{
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }>;
      introduction?: string | null;
      payment_terms?: string | null;
      valid_until?: string | null;
      tax_rate?: number | null;
    },
    lexwareContactId: string
  ): LexwareQuotation {
    const taxRate = quote.tax_rate || 19;

    return {
      voucherDate: new Date().toISOString().split("T")[0],
      expirationDate: quote.valid_until || undefined,
      address: {
        contactId: lexwareContactId,
      },
      lineItems: quote.line_items.map((item) => ({
        type: "custom" as const,
        name: item.description,
        quantity: item.quantity,
        unitName: item.unit,
        unitPrice: {
          currency: "EUR",
          netAmount: item.unit_price,
          taxRatePercentage: taxRate,
        },
      })),
      taxConditions: {
        taxType: "net",
      },
      introduction: quote.introduction || undefined,
      paymentConditions: quote.payment_terms
        ? { paymentTermLabel: quote.payment_terms }
        : undefined,
    };
  }
}

// Custom error class
export class LexwareError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response: LexwareErrorResponse
  ) {
    super(message);
    this.name = "LexwareError";
  }
}

// Singleton instance for server-side use
let clientInstance: LexwareClient | null = null;

export function getLexwareClient(): LexwareClient {
  if (!clientInstance) {
    clientInstance = new LexwareClient();
  }
  return clientInstance;
}
