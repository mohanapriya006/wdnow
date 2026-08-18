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
  currency: string; status: ProjectStatus; created_at: string; updated_at: string;
  assigned_contractors_count: number;
}
export type MilestoneStatus = "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
export interface Milestone { id:string; project_id:string; name:string; start_date:string; due_date:string; description:string|null; priority:string; status:MilestoneStatus; created_at:string; updated_at:string; }
export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "FLAGGED" | "APPROVED" | "REJECTED";
/** What the user sees. SUBMITTED is surfaced as PENDING. */
export type TimesheetDisplayStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
export type AnomalySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AnomalyType =
  | "EXCESSIVE_HOURS" | "HOLIDAY_WORK" | "OVERLAPPING_ENTRY"
  | "MISSING_END_TIME" | "INVALID_END_TIME" | "DUPLICATE_ENTRY" | "TIME_RULE_VIOLATION";

export interface Anomaly {
  type: AnomalyType | string;
  severity: AnomalySeverity;
  date: string;
  hours: number;
  reason: string;
}

export interface TimeEntry {
  id: string; work_date: string; milestone_id: string | null; milestone_name: string | null;
  start_time: string | null; end_time: string | null;
  clock_in: string | null; clock_out: string | null;
  break_minutes: number; regular_hours: number; overtime_hours: number; total_hours: number;
  work_location: string | null; notes: string | null;
  is_flagged: number; flag_reason: string | null;
  is_holiday: boolean; holiday_name: string | null;
  has_anomaly: boolean; anomaly_severity: AnomalySeverity | null; anomalies: Anomaly[];
}

export interface ContractorTimesheetSummary {
  contractor_id: string; contractor_name: string; assignment_id: string; role: string;
  weekly_capacity: number; total_weeks: number;
  normal_reports: number; anomaly_reports: number;
  pending_reports: number; approved_reports: number; rejected_reports: number;
  total_hours: number; approved_hours: number; last_submitted_at: string | null;
}
export interface Timesheet {
  id: string; assignment_id: string; project_id: string | null; project_name: string;
  contractor_id: string; contractor_name: string;
  week_start: string; week_end: string;
  status: TimesheetStatus; display_status: TimesheetDisplayStatus;
  contractor_summary: string | null; vendor_comment: string | null;
  submitted_at: string | null; approved_at: string | null;
  rejected_at: string | null; rejection_reason: string | null;
  weekly_capacity: number;
  regular_hours: number; overtime_hours: number; total_hours: number;
  compensation: number; currency: string; days_logged: number;
  has_anomalies: boolean; anomaly_count: number; anomaly_severity: AnomalySeverity | null;
  anomalies: Anomaly[]; entries: TimeEntry[]; audit_history: string[];
}
export interface ProjectTimesheetAnalytics {
  project_id: string; project_name: string; total_contractors: number;
  total_hours: number; regular_hours: number; overtime_hours: number;
  approved_hours: number; pending_hours: number; labor_cost: number;
  utilization: number; timesheet_compliance: number;
  anomaly_reports: number; pending_reports: number;
}

export interface ContractorAssignmentResponse {
  has_assignment: boolean;
  assignment: ContractorAssignmentView | null;
}

/* ------------------------------------------------------------------ */
/* Worker performance (analytical KPI, never a rate change)            */
/* ------------------------------------------------------------------ */

export type PerformanceBand = "EXCELLENT" | "STRONG" | "FAIR" | "NEEDS_ATTENTION" | "NO_DATA";

export interface PerformanceComponent {
  key: string;
  label: string;
  weight: number;
  /** 0-100, or null when the underlying data does not exist yet. */
  value: number | null;
  applied_weight: number;
  detail: string;
}

export interface PerformanceScore {
  contractor_id: string;
  contractor_name: string | null;
  score: number | null;
  band: PerformanceBand;
  components: PerformanceComponent[];
  reports_considered: number;
  calculated_at: string;
}

/* ------------------------------------------------------------------ */
/* Invoicing                                                           */
/* ------------------------------------------------------------------ */

export type InvoiceStatus =
  | "DRAFT" | "GENERATED" | "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED";
export type InvoiceLineType =
  | "REGULAR" | "OVERTIME" | "TAX" | "DEDUCTION" | "ADJUSTMENT";
export type TaxRuleType = "TAX" | "DEDUCTION";

export interface InvoiceTaxRule {
  id: string;
  code: string;
  label: string;
  rule_type: TaxRuleType;
  rate_percent: number;
  is_active: boolean;
  sort_order: number;
}

export interface InvoiceLine {
  id: string;
  line_type: InvoiceLineType;
  description: string;
  week_start: string | null;
  week_end: string | null;
  quantity: number;
  rate: number;
  amount: number;
  timesheet_id: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  vendor_name: string | null;
  contractor_id: string;
  contractor_name: string | null;
  assignment_id: string;
  project_id: string | null;
  project_name: string | null;
  role: string | null;

  period_start: string;
  period_end: string;
  invoice_date: string;
  due_date: string;
  currency: string;

  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  hourly_rate: number;
  overtime_multiplier: number;

  base_amount: number;
  overtime_amount: number;
  gross_amount: number;
  taxable_amount: number;
  tax_amount: number;
  deduction_amount: number;
  adjustment_amount: number;
  net_payable: number;

  performance_score: number | null;
  performance_adjusted_amount: number | null;

  status: InvoiceStatus;
  notes: string | null;
  rejection_reason: string | null;
  payment_reference: string | null;
  payment_date: string | null;

  is_overdue: boolean;
  weeks_billed: number;

  generated_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  rejected_at: string | null;
  created_at: string;

  lines: InvoiceLine[];
  audit_history: string[];
}

export interface BillableWeek {
  timesheet_id: string;
  week_start: string;
  week_end: string;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  approved_at: string | null;
  had_anomalies: boolean;
}

export interface BillableAssignment {
  assignment_id: string;
  contractor_id: string;
  contractor_name: string;
  project_id: string | null;
  project_name: string;
  role: string;
  currency: string;
  hourly_rate: number;
  weekly_capacity: number;
  weeks: BillableWeek[];
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  estimated_gross: number;
  estimated_net: number;
  performance_score: number | null;
  earliest_week: string | null;
  latest_week: string | null;
}

export interface InvoicePreview {
  assignment_id: string;
  contractor_id: string;
  contractor_name: string;
  project_id: string | null;
  project_name: string;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  hourly_rate: number;
  overtime_multiplier: number;
  regular_hours: number;
  overtime_hours: number;
  total_hours: number;
  base_amount: number;
  overtime_amount: number;
  gross_amount: number;
  taxable_amount: number;
  tax_amount: number;
  deduction_amount: number;
  adjustment_amount: number;
  net_payable: number;
  weeks_billed: number;
  performance_score: number | null;
  performance_adjusted_amount: number | null;
  lines: InvoiceLine[];
  warnings: string[];
}

export interface InvoiceSummary {
  total_invoices: number;
  generated_count: number;
  submitted_count: number;
  approved_count: number;
  paid_count: number;
  rejected_count: number;
  overdue_count: number;
  gross_total: number;
  tax_total: number;
  deduction_total: number;
  net_total: number;
  paid_total: number;
  outstanding_total: number;
  billable_contractors: number;
  billable_hours: number;
  billable_estimated_net: number;
  currency: string;
}

/* ------------------------------------------------------------------ */
/* Milestone analytics (vendor only)                                   */
/* ------------------------------------------------------------------ */

export type MilestoneRisk = "ON_TRACK" | "AT_RISK" | "OVERDUE" | "COMPLETE";

export interface MilestoneRow {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  description: string | null;
  start_date: string;
  due_date: string;
  completed_at: string | null;
  priority: string;
  status: MilestoneStatus;
  /** Negative = early, positive = late. Null while still open. */
  variance_days: number | null;
  days_to_due: number | null;
  is_overdue: boolean;
  risk: MilestoneRisk;
  assigned_contractors: string[];
  logged_hours: number;
}

export interface ProjectMilestoneProgress {
  project_id: string;
  project_name: string;
  project_status: ProjectStatus;
  start_date: string;
  end_date: string | null;
  total_milestones: number;
  completed: number;
  in_progress: number;
  upcoming: number;
  overdue: number;
  at_risk: number;
  completion_percent: number;
  on_time_percent: number | null;
  avg_variance_days: number | null;
  assigned_contractors: number;
  next_due: string | null;
  risk: MilestoneRisk;
}

export interface MilestoneDashboard {
  total_projects: number;
  total_milestones: number;
  completed: number;
  in_progress: number;
  upcoming: number;
  overdue: number;
  at_risk: number;
  completion_percent: number;
  on_time_percent: number | null;
  projects: ProjectMilestoneProgress[];
  upcoming_deadlines: MilestoneRow[];
  recent_activity: MilestoneRow[];
  milestones: MilestoneRow[];
}

export interface ApiErrorBody {
  detail?: string | { field: string; message: string }[] | any;
  errors?: { field: string; message: string }[];
}

export interface ContractorRecommendation {
  contractor_id: string;
  name: string;
  match_score: number;
  skill_score: number;
  experience_score: number;
  location_score: number;
  availability_score: number;
  matched_skills: string[];
  missing_skills: string[];
  experience_years: number;
  experience?: string | null;
  location?: string | null;
  status: "ON_BENCH" | "ALREADY_ASSIGNED" | string;
  current_project?: string | null;
  current_assignment_id?: string | null;
  recommendation: "STRONG_MATCH" | "GOOD_MATCH" | "POTENTIAL_MATCH" | "WEAK_MATCH" | string;
  explanation?: string | null;
}

export interface ProjectRecommendationsResponse {
  project_id: string;
  project_name: string;
  role: string;
  required_skills: string[];
  location?: string | null;
  total_candidates: number;
  recommendations: ContractorRecommendation[];
}
