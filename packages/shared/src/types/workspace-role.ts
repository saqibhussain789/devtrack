export const WORKSPACE_ROLES = ["OWNER", "ADMIN", "DEVELOPER", "VIEWER"] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const MEMBERSHIP_STATUSES = ["INVITED", "ACTIVE", "REMOVED"] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  DEVELOPER: 2,
  VIEWER: 1,
};

export function roleAtLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
