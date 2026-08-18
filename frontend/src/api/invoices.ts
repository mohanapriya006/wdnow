import { apiClient } from "./client";
import type {
  Invoice,
  VendorInvoiceSummary,
  InvoiceGeneratePayload,
  InvoiceStatus,
} from "./types";

export const listInvoices = async (statusFilter?: string) => {
  const params = statusFilter && statusFilter !== "ALL" ? { status: statusFilter } : {};
  return (await apiClient.get<Invoice[]>("/api/invoices", { params })).data;
};

export const getInvoiceSummary = async () =>
  (await apiClient.get<VendorInvoiceSummary>("/api/invoices/summary")).data;

export const generateInvoice = async (payload: InvoiceGeneratePayload) =>
  (await apiClient.post<Invoice>("/api/invoices/generate", payload)).data;

export const getInvoiceDetail = async (id: string) =>
  (await apiClient.get<Invoice>(`/api/invoices/${id}`)).data;

export const updateInvoiceStatus = async (id: string, status: InvoiceStatus) =>
  (await apiClient.patch<Invoice>(`/api/invoices/${id}/status`, { status })).data;
