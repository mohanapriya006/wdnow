import { apiClient } from "./client";
import type { LoginResponse, UserRole } from "./types";

export interface RegisterVendorPayload {
  company_name: string;
  contact_name?: string;
  email: string;
  phone?: string;
  address?: string;
  password: string;
  confirm_password?: string;
}

export interface UserMeResponse {
  id: string;
  email: string;
  role: UserRole;
  vendor_id: string | null;
  contractor_id: string | null;
  name: string;
}

export interface VendorPublic {
  id: string;
  name: string;
  email: string;
  status: string;
}

export interface RegisterContractorPayload {
  name: string;
  email: string;
  password: string;
  confirm_password?: string;
  vendor_id: string;
  phone?: string;
  location?: string;
  skills?: string;
  experience?: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/auth/login", { email, password });
  return data;
}

export async function registerVendor(payload: RegisterVendorPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/auth/register/vendor", payload);
  return data;
}

export async function registerContractor(payload: RegisterContractorPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/auth/register/contractor", payload);
  return data;
}

export async function getPublicVendors(): Promise<VendorPublic[]> {
  const { data } = await apiClient.get<VendorPublic[]>("/api/auth/vendors");
  return data;
}

export async function getMe(): Promise<UserMeResponse> {
  const { data } = await apiClient.get<UserMeResponse>("/api/auth/me");
  return data;
}


