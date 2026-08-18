import { apiClient } from "./client";
import type { Timesheet, ProjectTimesheetAnalytics } from "./types";
export const myTimesheets=async()=> (await apiClient.get<Timesheet[]>("/api/timesheets/me")).data;
export const logTime=async(p:any)=> (await apiClient.post<Timesheet>("/api/timesheets/me/entries",p)).data;
export const submitTimesheet=async(id:string, contractor_summary?:string)=> (await apiClient.post<Timesheet>(`/api/timesheets/${id}/submit`,{contractor_summary})).data;
export const projectTimesheetAnalytics=async()=> (await apiClient.get<ProjectTimesheetAnalytics[]>("/api/timesheets/vendor/projects")).data;
export const projectTimesheets=async(id:string)=> (await apiClient.get<Timesheet[]>(`/api/timesheets/vendor/projects/${id}`)).data;
export const reviewTimesheet=async(id:string,p:any)=> (await apiClient.post<Timesheet>(`/api/timesheets/vendor/${id}/review`,p)).data;
