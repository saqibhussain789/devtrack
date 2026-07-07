import type { Prisma } from "../../../generated/prisma";
import { prisma } from "../../lib/prisma";
import { emitToUser } from "../../sockets/io";

const NOTIFICATION_SELECT = {
  id: true,
  type: true,
  title: true,
  message: true,
  metadata: true,
  readAt: true,
  createdAt: true,
  projectId: true,
} as const;

interface CreateNotificationInput {
  userId: string;
  workspaceId: string;
  projectId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Persists a notification and pushes it over the socket in the same call, so
 * every call site (task assignment, PR sync, deployment failure) gets both
 * the durable record and the realtime nudge for free instead of remembering
 * to do both separately.
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
    },
    select: NOTIFICATION_SELECT,
  });

  emitToUser(input.userId, "notification:new", notification);

  return notification;
}

export async function listNotifications(userId: string) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: NOTIFICATION_SELECT,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { notifications, unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
