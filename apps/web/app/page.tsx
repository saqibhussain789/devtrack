"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { Brand } from "../components/brand";
import { ThemeToggle } from "../components/theme-toggle";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-ink-muted">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-border bg-surface p-8 text-center">
        <div className="flex justify-center">
          <Brand />
        </div>
        <p className="text-sm text-ink-muted">
          Task tracking, GitHub PR visibility, and deployment metrics for dev teams.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand/90"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-border/40"
          >
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
