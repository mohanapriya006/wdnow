import { apiClient } from "./client";
import type {
  Contractor,
  ContractorWithAssignmentStatus,
  ContractorMe,
  ContractorAssignmentResponse,
} from "./types";

export async function listMyContractors(): Promise<ContractorWithAssignmentStatus[]> {
  const { data } = await apiClient.get<ContractorWithAssignmentStatus[]>(
    "/api/vendors/me/contractors"
  );
  return data;
}

export interface ContractorCreatePayload {
  name: string;
  email: string;
  phone?: string;
  skills?: string;
  experience?: string;
  location?: string;
  password?: string;
}

export async function addContractor(payload: ContractorCreatePayload): Promise<Contractor> {
  const { data } = await apiClient.post<Contractor>("/api/vendors/me/contractors", payload);
  return data;
}

export async function getContractor(id: string): Promise<Contractor> {
  const { data } = await apiClient.get<Contractor>(`/api/contractors/${id}`);
  return data;
}

export async function getMyContractorProfile(): Promise<ContractorMe> {
  const { data } = await apiClient.get<ContractorMe>("/api/contractors/me");
  return data;
}

export async function getMyContractorAssignment(): Promise<ContractorAssignmentResponse> {
  const { data } = await apiClient.get<ContractorAssignmentResponse>(
    "/api/contractors/me/assignment"
  );
  return data;
}
