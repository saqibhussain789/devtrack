"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface Member {
  id: string;
  status: string;
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);

  const workspace = user?.memberships[0]?.workspace;
  const role = user?.memberships[0]?.role;

  const loadMembers = useCallback(async () => {
    if (!workspace || !accessToken) return;

    try {
      const data = await apiFetch<Member[]>(`/workspaces/${workspace.id}/members`, { accessToken });
      setMembers(data);
      setMembersError(null);
    } catch (err) {
      setMembersError(err instanceof ApiError ? err.message : "Unable to load members.");
    }
  }, [workspace, accessToken]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (!user || !workspace) {
    return null;
  }

  const activeCount = members.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Overview</h1>
        <p className="mt-1 text-sm text-ink-muted">A snapshot of {workspace.name}.</p>
      </div>

      {membersError && <p className="text-sm text-status-blocked">{membersError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Members" value={members.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Your role" value={role ?? "—"} />
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Team &amp; roles</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Invite teammates, change roles, or remove members from {workspace.name}.
        </p>
        <Link
          href="/dashboard/settings"
          className="mt-4 inline-flex rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-border/40"
        >
          Manage in Settings →
        </Link>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
