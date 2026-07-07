"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { apiFetch } from "./api";
import { useAuth } from "./auth-context";
import { createSocket } from "./socket";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  projectId: string | null;
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  const load = useCallback(async (token: string) => {
    const result = await apiFetch<{ notifications: NotificationItem[]; unreadCount: number }>("/notifications", {
      accessToken: token,
    });
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    if (!accessToken) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    load(accessToken);

    const socket = createSocket(accessToken);
    socketRef.current = socket;
    socket.on("notification:new", (notification: NotificationItem) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, load]);

  const markRead = useCallback(async (id: string) => {
    let wasUnread = false;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.readAt) wasUnread = true;
        return n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n;
      })
    );

    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await apiFetch(`/notifications/${id}/read`, { method: "PATCH", accessToken }).catch(() => undefined);
    }
  }, [accessToken]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    await apiFetch("/notifications/read-all", { method: "PATCH", accessToken }).catch(() => undefined);
  }, [accessToken]);

  const value = useMemo(
    () => ({ notifications, unreadCount, markRead, markAllRead }),
    [notifications, unreadCount, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);

  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationsProvider.");
  }

  return ctx;
}
