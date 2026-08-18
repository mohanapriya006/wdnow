import { apiClient } from "./client";
import type { Assignment, AssignmentStatus } from "./types";

export async function listMyAssignments(): Promise<Assignment[]> {
  const { data } = await apiClient.get<Assignment[]>("/api/assignments");
  return data;
}

export interface AssignmentCreatePayload {
  contractor_id: string;
  project_name: string;
  role: string;
  start_date: string;
  end_date?: string | null;
  working_hours: number;
  pay_rate: number;
  bill_rate: number;
  currency?: string;
  notes?: string;
}

export async function createAssignment(payload: AssignmentCreatePayload): Promise<Assignment> {
  const { data } = await apiClient.post<Assignment>("/api/assignments", payload);
  return data;
}

export async function getAssignment(id: string): Promise<Assignment> {
  const { data } = await apiClient.get<Assignment>(`/api/assignments/${id}`);
  return data;
}

export interface AssignmentUpdatePayload {
  project_name?: string;
  role?: string;
  start_date?: string;
  end_date?: string | null;
  working_hours?: number;
  pay_rate?: number;
  bill_rate?: number;
  status?: AssignmentStatus;
  notes?: string;
}

export async function updateAssignment(
  id: string,
  payload: AssignmentUpdatePayload
): Promise<Assignment> {
  const { data } = await apiClient.patch<Assignment>(`/api/assignments/${id}`, payload);
  return data;
}
