import { apiClient } from "./client";
import type {
  BillableAssignment,
  Invoice,
  InvoicePreview,
  InvoiceStatus,
  InvoiceSummary,
  InvoiceTaxRule,
  PerformanceScore,
} from "./types";

export interface InvoiceFilters {
  contractor_id?: string;
  project_id?: string;
  status?: InvoiceStatus;
  date_from?: string;
  date_to?: string;
  q?: string;
}

export interface InvoicePreviewInput {
  assignment_id: string;
  period_start?: string;
  period_end?: string;
  adjustment_amount?: number;
  adjustment_note?: string;
  overtime_multiplier?: number;
}

export interface InvoiceGenerateInput extends InvoicePreviewInput {
  invoice_date?: string;
  due_date?: string;
  notes?: string;
}

export interface InvoiceTransitionInput {
  action: "SUBMIT" | "APPROVE" | "REJECT" | "MARK_PAID";
  reason?: string;
  payment_reference?: string;
  payment_date?: string;
}

/* ---- Vendor ---- */
export const listInvoices = async (filters: InvoiceFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return (await apiClient.get<Invoice[]>("/api/invoices/vendor", { params })).data;
};

export const invoiceSummary = async () =>
  (await apiClient.get<InvoiceSummary>("/api/invoices/vendor/summary")).data;

export const billableWork = async () =>
  (await apiClient.get<BillableAssignment[]>("/api/invoices/vendor/billable")).data;

export const previewInvoice = async (payload: InvoicePreviewInput) =>
  (await apiClient.post<InvoicePreview>("/api/invoices/vendor/preview", payload)).data;

export const generateInvoice = async (payload: InvoiceGenerateInput) =>
  (await apiClient.post<Invoice>("/api/invoices/vendor/generate", payload)).data;

export const transitionInvoice = async (id: string, payload: InvoiceTransitionInput) =>
  (await apiClient.post<Invoice>(`/api/invoices/vendor/${id}/transition`, payload)).data;

export const listTaxRules = async () =>
  (await apiClient.get<InvoiceTaxRule[]>("/api/invoices/vendor/tax-rules")).data;

export const saveTaxRules = async (rules: Omit<InvoiceTaxRule, "id">[]) =>
  (await apiClient.put<InvoiceTaxRule[]>("/api/invoices/vendor/tax-rules", rules)).data;

export const contractorPerformance = async (contractorId: string) =>
  (
    await apiClient.get<PerformanceScore>(
      `/api/invoices/vendor/contractors/${contractorId}/performance`
    )
  ).data;

/* ---- Contractor ---- */
export const myInvoices = async () =>
  (await apiClient.get<Invoice[]>("/api/invoices/me")).data;

export const myPerformance = async () =>
  (await apiClient.get<PerformanceScore>("/api/invoices/me/performance")).data;

/* ---- Shared ---- */
export const getInvoice = async (id: string) =>
  (await apiClient.get<Invoice>(`/api/invoices/${id}`)).data;
