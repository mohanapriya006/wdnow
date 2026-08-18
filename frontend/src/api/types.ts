export type UserRole = "VENDOR" | "CONTRACTOR";
export type VendorStatus = "ACTIVE" | "INACTIVE" | "PENDING";
export type ContractorStatus = "ACTIVE" | "INACTIVE" | "BENCH";
export type AssignmentStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "TERMINATED";
export type ProjectStatus = "DRAFT" | "OPEN" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: string;
  vendor_id: string | null;
  contractor_id: string | null;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  status: VendorStatus;
  created_at: string;
}

export interface VendorDashboard {
  vendor: Vendor;
  active_contractors_count: number;
  active_assignments_count: number;
  total_contractors_count: number;
  total_assignments_count: number;
  pending_timesheets_count: number;
  pending_invoices_count: number;
}

export interface Contractor {
  id: string;
  vendor_id: string;
  name: string;
  email: string;
  phone: string | null;
  skills: string | null;
  experience: string | null;
  location: string | null;
  status: ContractorStatus;
  created_at: string;
}

export interface ContractorWithAssignmentStatus extends Contractor {
  current_assignment_status: AssignmentStatus | null;
  current_assignment_project: string | null;
}

export interface ContractorMe extends Contractor {
  vendor_name: string;
}

export interface Assignment {
  id: string;
  vendor_id: string;
  contractor_id: string;
  project_id: string | null;
  project_name: string;
  role: string;
  start_date: string;
  end_date: string | null;
  working_hours: number;
  pay_rate: number;
  bill_rate: number;
  currency: string;
  status: AssignmentStatus;
  notes: string | null;
  description: string | null;
  required_skills: string | null;
  location: string | null;
  work_mode: string | null;
  created_at: string;
  updated_at: string;
  contractor_name?: string | null;
  vendor_name?: string | null;
}

export interface ContractorAssignmentView {
  id: string;
  project_name: string;
  role: string;
  vendor_name: string;
  start_date: string;
  end_date: string | null;
  working_hours: number;
  pay_rate: number;
  currency: string;
  status: AssignmentStatus;
  created_at: string;
  description: string | null;
  required_skills: string | null;
  location: string | null;
  work_mode: string | null;
}

export interface Project {
  id: string; vendor_id: string; name: string; description: string | null; role: string;
  required_skills: string | null; start_date: string; end_date: string | null;
  location: string | null; work_mode: string; working_hours: number; pay_rate: number;
  bill_rate: number; currency: string; status: ProjectStatus; created_at: string; updated_at: string;
  assigned_contractors_count: number;
}
export type MilestoneStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
export interface Milestone { id:string; project_id:string; name:string; start_date:string; due_date:string; description:string|null; priority:string; status:MilestoneStatus; created_at:string; updated_at:string; }
export interface TimeEntry {
  id: string;
  work_date: string;
  milestone_id: string | null;
  milestone_name: string | null;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  work_location: string | null;
  notes: string | null;
  is_flagged: number;
  flag_reason: string | null;
}

export interface Timesheet {
  id: string;
  assignment_id: string;
  project_id: string | null;
  project_name: string;
  contractor_id?: string | null;
  contractor_name: string;
  week_start: string;
  week_end: string;
  status: "DRAFT" | "SUBMITTED" | "FLAGGED" | "APPROVED";
  contractor_summary: string | null;
  vendor_comment: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  pay_rate?: number;
  bill_rate?: number;
  currency?: string;
  compensation: number;
  labor_cost?: number;
  bill_amount?: number;
  gross_margin?: number;
  gross_margin_percent?: number;
  entries: TimeEntry[];
  audit_history: string[];
}

export interface VendorTimesheetSummary {
  total_timesheets: number;
  pending_count: number;
  approved_count: number;
  flagged_count: number;
  total_hours: number;
  total_labor_cost: number;
  total_bill_amount: number;
  total_gross_margin: number;
  currency: string;
}

export interface WeeklyDayEntryPayload {
  work_date: string;
  hours: number;
  notes?: string;
  work_location?: string;
  milestone_id?: string;
}

export interface WeeklyTimesheetBatchPayload {
  week_start: string;
  entries: WeeklyDayEntryPayload[];
  submit_now?: boolean;
  contractor_summary?: string;
}

export interface ProjectTimesheetAnalytics {
  project_id: string;
  project_name: string;
  total_contractors: number;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  approved_hours: number;
  pending_hours: number;
  labor_cost: number;
  utilization: number;
  timesheet_compliance: number;
}

export interface ContractorAssignmentResponse {
  has_assignment: boolean;
  assignment: ContractorAssignmentView | null;
}

export interface ApiErrorBody {
  detail?: string | { field: string; message: string }[] | any;
  errors?: { field: string; message: string }[];
}

// ---------------------------------------------------------------------------
// Invoices & Client Billing
// ---------------------------------------------------------------------------

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "CANCELLED";

export interface InvoiceItem {
  id: string;
  timesheet_id?: string | null;
  contractor_name: string;
  project_name: string;
  role: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface Invoice {
  id: string;
  vendor_id: string;
  invoice_number: string;
  client_name: string;
  client_email?: string | null;
  client_address?: string | null;
  billing_period_start: string;
  billing_period_end: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: InvoiceStatus;
  notes?: string | null;
  created_at: string;
  items: InvoiceItem[];
}

export interface VendorInvoiceSummary {
  total_invoices: number;
  total_billed: number;
  total_paid: number;
  total_outstanding: number;
  issued_count: number;
  paid_count: number;
  currency: string;
}

export interface InvoiceGeneratePayload {
  client_name: string;
  client_email?: string;
  client_address?: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string;
  tax_rate?: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Contractor Payroll & Pay Slips
// ---------------------------------------------------------------------------

export type PayrollStatus = "PENDING" | "PROCESSING" | "PAID";

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  contractor_id: string;
  assignment_id?: string | null;
  timesheet_id?: string | null;
  contractor_name: string;
  project_name: string;
  role: string;
  period_start: string;
  period_end: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  pay_rate: number;
  gross_pay: number;
  tax_rate: number;
  tax_withheld: number;
  net_payout: number;
  currency: string;
  status: PayrollStatus;
  bank_reference?: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: string;
  vendor_id: string;
  run_reference: string;
  period_start: string;
  period_end: string;
  total_contractors: number;
  total_hours: number;
  total_gross_pay: number;
  total_tax_withheld: number;
  total_net_payout: number;
  currency: string;
  status: PayrollStatus;
  payment_method: string;
  notes?: string | null;
  disbursed_at: string;
  created_at: string;
  items: PayrollItem[];
}

export interface PayrollRunCreatePayload {
  period_start: string;
  period_end: string;
  tax_rate?: number;
  payment_method?: string;
  notes?: string;
}

export interface ContractorPayrollSummary {
  lifetime_earnings: number;
  pending_payout: number;
  last_disbursed_amount: number;
  last_disbursed_date?: string | null;
  total_paid_slips: number;
  currency: string;
}

export interface VendorPayrollSummary {
  total_runs: number;
  total_disbursed: number;
  total_tax_withheld: number;
  pending_disbursement: number;
  active_contractors_paid: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// In-App Notifications
// ---------------------------------------------------------------------------

export type NotificationCategory = "ASSIGNMENT" | "TIMESHEET" | "PAYROLL" | "INVOICE" | "SYSTEM";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  link_url?: string | null;
  is_read: number;
  created_at: string;
}

export interface NotificationListResponse {
  unread_count: number;
  total_count: number;
  items: NotificationItem[];
}
