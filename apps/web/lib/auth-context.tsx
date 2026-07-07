"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";

interface Membership {
  role: string;
  workspace: { id: string; name: string; slug: string };
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  createdAt: string;
  memberships: Membership[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async (token: string) => {
    const me = await apiFetch<CurrentUser>("/me", { accessToken: token });
    setUser(me);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const session = await apiFetch<{ accessToken: string }>("/auth/refresh", { method: "POST" });
        setAccessToken(session.accessToken);
        await loadMe(session.accessToken);
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAccessToken(session.accessToken);
      await loadMe(session.accessToken);
    },
    [loadMe]
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await apiFetch<{ accessToken: string }>("/auth/register", {
        method: "POST",
        body: { name, email, password },
      });
      setAccessToken(session.accessToken);
      await loadMe(session.accessToken);
    },
    [loadMe]
  );

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (accessToken) {
      await loadMe(accessToken);
    }
  }, [accessToken, loadMe]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, loading, login, register, logout, refreshUser }),
    [user, accessToken, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return ctx;
}
