import { apiClient } from "./client";
import type { Project, ProjectStatus } from "./types";
import type { Milestone } from "./types";

export type ProjectPayload = Omit<Pick<Project, "name" | "description" | "role" | "required_skills" | "start_date" | "end_date" | "location" | "work_mode" | "working_hours" | "pay_rate" | "bill_rate" | "currency" | "status">, "status"> & { status?: ProjectStatus };
export async function listProjects(): Promise<Project[]> { const { data } = await apiClient.get("/api/projects"); return data; }
export async function createProject(payload: ProjectPayload): Promise<Project> { const { data } = await apiClient.post("/api/projects", payload); return data; }
export async function listMilestones(projectId:string): Promise<Milestone[]> { return (await apiClient.get(`/api/projects/${projectId}/milestones`)).data; }
export async function createMilestone(projectId:string,payload:any): Promise<Milestone> { return (await apiClient.post(`/api/projects/${projectId}/milestones`,payload)).data; }
export async function updateMilestone(projectId:string,id:string,payload:any): Promise<Milestone> { return (await apiClient.patch(`/api/projects/${projectId}/milestones/${id}`,payload)).data; }
