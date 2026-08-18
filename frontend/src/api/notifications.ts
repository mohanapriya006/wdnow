import { apiClient } from "./client";
import type { NotificationListResponse, NotificationItem } from "./types";

export const getMyNotifications = async () =>
  (await apiClient.get<NotificationListResponse>("/api/notifications")).data;

export const markNotificationRead = async (id: string) =>
  (await apiClient.patch<NotificationItem>(`/api/notifications/${id}/read`)).data;

export const markAllNotificationsRead = async () =>
  (await apiClient.post<NotificationListResponse>("/api/notifications/read-all")).data;
