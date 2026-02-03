// Billing and Invoice System Types

export interface Customer {
  id: string;
  name: string;
  company?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pricing {
  id: string;
  name: string;
  description?: string;
  unit: 'hour' | 'meter' | 'fixed' | 'per_street';
  price_per_unit: number;
  tax_rate: number;
  is_active: boolean;
  valid_from: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  is_default: boolean;
  header_logo_url?: string;
  header_text?: string;
  footer_text?: string;
  company_name?: string;
  company_address?: string;
  company_postal_code?: string;
  company_city?: string;
  company_tax_id?: string;
  company_phone?: string;
  company_email?: string;
  company_website?: string;
  company_bank_name?: string;
  company_bank_iban?: string;
  company_bank_bic?: string;
  payment_terms?: string;
  notes?: string;
  css_styles?: string;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  customer?: Customer;
  template_id?: string;
  template?: InvoiceTemplate;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  period_start?: string;
  period_end?: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes?: string;
  internal_notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit?: string;
  price_per_unit: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  street_id?: string;
  work_log_id?: string;
  date_performed?: string;
  created_at: string;
}

export type SnapshotType = 'invoice' | 'report' | 'pricing' | 'template';

export interface Snapshot {
  id: string;
  snapshot_type: SnapshotType;
  reference_id: string;
  reference_number?: string;
  customer_id?: string;
  customer?: Customer;
  snapshot_date: string;
  data: Record<string, unknown>;
  template_snapshot?: Record<string, unknown>;
  pricing_snapshot?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  notes?: string;
}

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom' | 'work_summary';
export type ReportStatus = 'draft' | 'finalized' | 'archived';

export interface Report {
  id: string;
  report_number: string;
  report_type: ReportType;
  title: string;
  period_start: string;
  period_end: string;
  customer_id?: string;
  customer?: Customer;
  data: ReportData;
  status: ReportStatus;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportData {
  streets?: {
    id: string;
    name: string;
    city: string;
    area: string;
    status_history: {
      date: string;
      status: string;
      started_at?: string;
      finished_at?: string;
      assigned_users: string[];
    }[];
  }[];
  work_logs?: {
    id: string;
    user_name: string;
    date: string;
    start_time: string;
    end_time: string;
    street?: string;
    notes?: string;
    duration_minutes: number;
  }[];
  summary?: {
    total_hours: number;
    total_streets: number;
    streets_completed: number;
    streets_in_progress: number;
    streets_open: number;
  };
  metadata?: {
    generated_at: string;
    generated_by: string;
    period: { start: string; end: string };
  };
}

// Form types for creating/editing
export interface CustomerFormData {
  name: string;
  company?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PricingFormData {
  name: string;
  description?: string;
  unit: Pricing['unit'];
  price_per_unit: number;
  tax_rate?: number;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

export interface InvoiceFormData {
  customer_id: string;
  template_id?: string;
  issue_date: string;
  due_date: string;
  period_start?: string;
  period_end?: string;
  notes?: string;
  internal_notes?: string;
  items: InvoiceItemFormData[];
}

export interface InvoiceItemFormData {
  description: string;
  quantity: number;
  unit?: string;
  price_per_unit: number;
  tax_rate?: number;
  street_id?: string;
  work_log_id?: string;
  date_performed?: string;
}

// PDF Generation Options
export interface PDFGenerationOptions {
  format: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  includeHeader: boolean;
  includeFooter: boolean;
  includeLogo: boolean;
  template_id?: string;
}
