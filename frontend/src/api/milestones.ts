import { apiClient } from "./client";
import type { MilestoneDashboard, MilestoneRisk, MilestoneStatus } from "./types";

export interface MilestoneFilters {
  project_id?: string;
  status?: MilestoneStatus;
  risk?: MilestoneRisk;
  q?: string;
}

/** Vendor-only delivery analytics across every project. */
export const milestoneDashboard = async (filters: MilestoneFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "")
  );
  return (
    await apiClient.get<MilestoneDashboard>("/api/milestones/vendor/dashboard", { params })
  ).data;
};
