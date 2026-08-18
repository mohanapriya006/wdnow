import { apiClient } from "./client";
import type { Vendor, VendorDashboard } from "./types";

export async function getMyVendorProfile(): Promise<Vendor> {
  const { data } = await apiClient.get<Vendor>("/api/vendors/me");
  return data;
}

export interface VendorUpdatePayload {
  name?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
}

export async function updateMyVendorProfile(payload: VendorUpdatePayload): Promise<Vendor> {
  const { data } = await apiClient.patch<Vendor>("/api/vendors/me", payload);
  return data;
}

export async function getMyVendorDashboard(): Promise<VendorDashboard> {
  const { data } = await apiClient.get<VendorDashboard>("/api/vendors/me/dashboard");
  return data;
}
