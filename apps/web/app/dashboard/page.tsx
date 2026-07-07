"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

interface Member {
  id: string;
  role: string;
  status: string;
  joinedAt: string | null;
  user: { id: string; name: string; email: string };
}

const ROLES = ["VIEWER", "DEVELOPER", "ADMIN", "OWNER"];

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-100",
  ADMIN: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-100",
  DEVELOPER: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
  VIEWER: "bg-stone-100 text-stone-500 dark:bg-stone-800/60 dark:text-stone-400",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-100",
  INVITED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  REMOVED: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

export default function DashboardPage() {
  const { user, accessToken } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DEVELOPER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const workspace = user?.memberships[0]?.workspace;
  const role = user?.memberships[0]?.role;
  const canManageMembers = role === "OWNER" || role === "ADMIN";

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

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    if (!workspace || !accessToken) return;

    setInviting(true);
    setInviteError(null);

    try {
      await apiFetch(`/workspaces/${workspace.id}/invites`, {
        method: "POST",
        accessToken,
        body: { email: inviteEmail, role: inviteRole },
      });
      setInviteEmail("");
      await loadMembers();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Unable to send invite.");
    } finally {
      setInviting(false);
    }
  }

  if (!user || !workspace) {
    return null;
  }

  const activeCount = members.filter((m) => m.status === "ACTIVE").length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">Overview</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          A snapshot of {workspace.name}. Kanban, GitHub, and deploy metrics land in later phases.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Members" value={members.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Your role" value={role ?? "—"} />
      </div>

      <section className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Members</h2>
        </div>

        {membersError && <p className="px-5 py-4 text-sm text-red-600 dark:text-red-400">{membersError}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-stone-100 last:border-0 dark:border-stone-800/60">
                  <td className="px-5 py-3 font-medium text-stone-900 dark:text-stone-100">{member.user.name}</td>
                  <td className="px-5 py-3 text-stone-500 dark:text-stone-400">{member.user.email}</td>
                  <td className="px-5 py-3">
                    <Badge label={member.role} className={ROLE_BADGE[member.role] ?? ""} />
                  </td>
                  <td className="px-5 py-3">
                    <Badge label={member.status} className={STATUS_BADGE[member.status] ?? ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canManageMembers && (
        <section className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
          <h2 className="mb-4 text-sm font-semibold text-stone-900 dark:text-stone-100">Invite a member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label htmlFor="invite-email" className="text-xs font-medium text-stone-600 dark:text-stone-300">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-role" className="text-xs font-medium text-stone-600 dark:text-stone-300">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{inviteError}</p>}
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">{value}</p>
    </div>
  );
}
