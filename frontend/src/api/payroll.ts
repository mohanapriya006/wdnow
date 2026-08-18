import { apiClient } from "./client";
import type {
  PayrollRun,
  PayrollItem,
  VendorPayrollSummary,
  ContractorPayrollSummary,
  PayrollRunCreatePayload,
} from "./types";

export const getVendorPayrollSummary = async () =>
  (await apiClient.get<VendorPayrollSummary>("/api/payroll/vendor/summary")).data;

export const listVendorPayrollRuns = async () =>
  (await apiClient.get<PayrollRun[]>("/api/payroll/vendor/runs")).data;

export const executePayrollRun = async (payload: PayrollRunCreatePayload) =>
  (await apiClient.post<PayrollRun>("/api/payroll/vendor/run", payload)).data;

export const getContractorPayrollSummary = async () =>
  (await apiClient.get<ContractorPayrollSummary>("/api/payroll/contractor/me")).data;

export const listContractorPaySlips = async () =>
  (await apiClient.get<PayrollItem[]>("/api/payroll/contractor/pay-slips")).data;

export const getPaySlipDetail = async (id: string) =>
  (await apiClient.get<PayrollItem>(`/api/payroll/contractor/pay-slips/${id}`)).data;
