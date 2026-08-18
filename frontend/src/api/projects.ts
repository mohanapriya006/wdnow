import { apiClient } from "./client";
import type { Project, ProjectStatus } from "./types";

export type ProjectPayload = Omit<Pick<Project, "name" | "description" | "role" | "required_skills" | "start_date" | "end_date" | "location" | "work_mode" | "working_hours" | "pay_rate" | "bill_rate" | "currency" | "status">, "status"> & { status?: ProjectStatus };
export async function listProjects(): Promise<Project[]> { const { data } = await apiClient.get("/api/projects"); return data; }
export async function createProject(payload: ProjectPayload): Promise<Project> { const { data } = await apiClient.post("/api/projects", payload); return data; }
