"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

interface Member {
  id: string;
  role: string;
  status: string;
  joinedAt: string | null;
  user: { id: string; name: string; email: string };
}

const ROLES = ["VIEWER", "DEVELOPER", "ADMIN", "OWNER"];

const ROLE_BADGE: Record<string, string> = {
  OWNER: "bg-brand/10 text-brand",
  ADMIN: "bg-status-done/15 text-status-done",
  DEVELOPER: "bg-border/50 text-ink",
  VIEWER: "bg-border/30 text-ink-muted",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-status-done/15 text-status-done",
  INVITED: "bg-status-progress/15 text-status-progress",
  REMOVED: "bg-status-blocked/15 text-status-blocked",
};

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}

export default function SettingsPage() {
  const { user, accessToken } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);

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

  async function handleRoleChange(memberId: string, nextRole: string) {
    if (!workspace || !accessToken) return;

    setPendingMemberId(memberId);
    setMemberActionError(null);

    try {
      await apiFetch(`/workspaces/${workspace.id}/members/${memberId}`, {
        method: "PATCH",
        accessToken,
        body: { role: nextRole },
      });
      await loadMembers();
    } catch (err) {
      setMemberActionError(err instanceof ApiError ? err.message : "Unable to update role.");
    } finally {
      setPendingMemberId(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (!workspace || !accessToken) return;
    if (!window.confirm("Remove this member from the workspace?")) return;

    setPendingMemberId(memberId);
    setMemberActionError(null);

    try {
      await apiFetch(`/workspaces/${workspace.id}/members/${memberId}`, {
        method: "PATCH",
        accessToken,
        body: { status: "REMOVED" },
      });
      await loadMembers();
    } catch (err) {
      setMemberActionError(err instanceof ApiError ? err.message : "Unable to remove member.");
    } finally {
      setPendingMemberId(null);
    }
  }

  if (!user || !workspace) {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage {workspace.name}&apos;s team and roles.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Members</h2>
        </div>

        {membersError && <p className="px-5 py-4 text-sm text-status-blocked">{membersError}</p>}
        {memberActionError && <p className="px-5 pt-3 text-sm text-status-blocked">{memberActionError}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {canManageMembers && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.user.id === user.id;
                const isPending = pendingMemberId === member.id;

                return (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium text-ink">{member.user.name}</td>
                    <td className="px-5 py-3 text-ink-muted">{member.user.email}</td>
                    <td className="px-5 py-3">
                      {canManageMembers ? (
                        <select
                          value={member.role}
                          disabled={isPending}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge label={member.role} className={ROLE_BADGE[member.role] ?? ""} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={member.status} className={STATUS_BADGE[member.status] ?? ""} />
                    </td>
                    {canManageMembers && (
                      <td className="px-5 py-3">
                        {member.status !== "REMOVED" && (
                          <button
                            onClick={() => handleRemove(member.id)}
                            disabled={isPending || isSelf}
                            title={isSelf ? "You can't remove yourself" : undefined}
                            className="text-xs font-medium text-status-blocked transition-colors hover:text-status-blocked/80 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {canManageMembers && (
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Invite a member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label htmlFor="invite-email" className="text-xs font-medium text-ink-muted">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="invite-role" className="text-xs font-medium text-ink-muted">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
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
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {inviting ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteError && <p className="mt-3 text-sm text-status-blocked">{inviteError}</p>}
        </section>
      )}
    </div>
  );
}
