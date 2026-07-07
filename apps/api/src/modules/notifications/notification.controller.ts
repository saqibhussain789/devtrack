import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "./notification.service";

export const listNotificationsHandler = asyncHandler(async (req, res) => {
  const result = await listNotifications(req.user!.id);
  ApiResponse.success(res, req, result);
});

export const markNotificationReadHandler = asyncHandler(async (req, res) => {
  await markNotificationRead(req.user!.id, req.params.id as string);
  ApiResponse.success(res, req, { marked: true });
});

export const markAllNotificationsReadHandler = asyncHandler(async (req, res) => {
  await markAllNotificationsRead(req.user!.id);
  ApiResponse.success(res, req, { marked: true });
});
