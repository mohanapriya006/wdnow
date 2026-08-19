import { apiClient } from "./client";
import type {
  Timesheet,
  ProjectTimesheetAnalytics,
  ContractorTimesheetSummary,
  TimesheetRiskBoard,
} from "./types";

export interface TimeEntryInput {
  work_date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  work_location?: string;
  notes?: string;
  /** Only needed when the contractor holds more than one assignment. */
  assignment_id?: string;
}

export interface ReviewInput {
  action: "APPROVE" | "REJECT" | "REQUEST_CORRECTION";
  reason?: string;
  entry_id?: string;
}

export interface RiskFilters {
  flag?: "FLAGGED" | "WARNING" | "CLEAN";
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  contractor_id?: string;
  project_id?: string;
  q?: string;
}

/* ---- Contractor ---- */
export const myTimesheets = async () =>
  (await apiClient.get<Timesheet[]>("/api/timesheets/me")).data;

export const logTime = async (payload: TimeEntryInput) =>
  (await apiClient.post<Timesheet>("/api/timesheets/me/entries", payload)).data;

export const deleteTimeEntry = async (entryId: string) =>
  (await apiClient.delete<Timesheet>(`/api/timesheets/me/entries/${entryId}`)).data;

export const submitTimesheet = async (id: string, contractor_summary?: string) =>
  (await apiClient.post<Timesheet>(`/api/timesheets/${id}/submit`, { contractor_summary })).data;

/* ---- Vendor: Timesheets -> Projects -> Contractor -> Weekly reports ---- */
export const projectTimesheetAnalytics = async () =>
  (await apiClient.get<ProjectTimesheetAnalytics[]>("/api/timesheets/vendor/projects")).data;

export const projectContractors = async (projectId: string) =>
  (
    await apiClient.get<ContractorTimesheetSummary[]>(
      `/api/timesheets/vendor/projects/${projectId}/contractors`
    )
  ).data;

export const projectTimesheets = async (projectId: string, contractorId?: string) =>
  (
    await apiClient.get<Timesheet[]>(`/api/timesheets/vendor/projects/${projectId}`, {
      params: contractorId ? { contractor_id: contractorId } : undefined,
    })
  ).data;

/** Contractor timesheet risk across the whole programme, calculated server-side. */
export const timesheetRiskBoard = async (filters: RiskFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return (await apiClient.get<TimesheetRiskBoard>("/api/timesheets/vendor/risk", { params })).data;
};

export const reviewTimesheet = async (id: string, payload: ReviewInput) =>
  (await apiClient.post<Timesheet>(`/api/timesheets/vendor/${id}/review`, payload)).data;
