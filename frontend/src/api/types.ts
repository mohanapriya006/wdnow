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
export interface TimeEntry { id:string; work_date:string; milestone_id:string|null; milestone_name:string|null; clock_in:string|null; clock_out:string|null; break_minutes:number; regular_hours:number; overtime_hours:number; total_hours:number; work_location:string|null; notes:string|null; is_flagged:number; flag_reason:string|null; }
export interface Timesheet { id:string; assignment_id:string; project_id:string|null; project_name:string; contractor_name:string; week_start:string; week_end:string; status:"DRAFT"|"SUBMITTED"|"FLAGGED"|"APPROVED"; contractor_summary:string|null; vendor_comment:string|null; submitted_at:string|null; approved_at:string|null; regular_hours:number; overtime_hours:number; total_hours:number; compensation:number; entries:TimeEntry[]; audit_history:string[]; }
export interface ProjectTimesheetAnalytics { project_id:string; project_name:string; total_contractors:number; total_hours:number; regular_hours:number; overtime_hours:number; approved_hours:number; pending_hours:number; labor_cost:number; utilization:number; timesheet_compliance:number; }

export interface ContractorAssignmentResponse {
  has_assignment: boolean;
  assignment: ContractorAssignmentView | null;
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
