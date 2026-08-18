import { apiClient } from "./client";
import type { ProjectRecommendationsResponse } from "./types";

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
