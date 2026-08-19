import { apiClient } from "./client";
import type { ProjectRecommendationsResponse, TimesheetExplanation } from "./types";

export async function getProjectRecommendations(
  projectId: string,
  topN: number = 10
): Promise<ProjectRecommendationsResponse> {
  const { data } = await apiClient.get<ProjectRecommendationsResponse>(
    `/api/ai/projects/${projectId}/recommendations`,
    {
      params: { top_n: topN },
    }
  );
  return data;
}

/**
 * Ask the AI to explain an anomaly the backend rule engine already detected.
 * The backend enforces vendor ownership before any data reaches the model, and
 * falls back to a deterministic explanation if Gemini is unavailable.
 */
export async function explainTimesheetRisk(
  timesheetId: string
): Promise<TimesheetExplanation> {
  const { data } = await apiClient.post<TimesheetExplanation>(
    "/api/ai/timesheet-explanation",
    { timesheet_id: timesheetId }
  );
  return data;
}
