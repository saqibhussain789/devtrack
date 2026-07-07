import type { InviteMemberInput, UpdateMemberInput } from "@repo/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { slugify, uniqueSlugSuffix } from "../../utils/slug";
import { recordAuditEvent } from "../audit/audit.service";

export async function listWorkspacesForUser(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      role: true,
      joinedAt: true,
      workspace: { select: { id: true, name: true, slug: true, createdAt: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m) => ({ ...m.workspace, role: m.role }));
}

export async function createWorkspace(userId: string, name: string) {
  const baseSlug = slugify(name) || "workspace";

  return prisma.$transaction(async (tx) => {
    let slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    }

    const workspace = await tx.workspace.create({
      data: { name, slug, createdBy: userId },
    });

    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
    });

    await recordAuditEvent({
      action: "workspace.create",
      entityType: "workspace",
      entityId: workspace.id,
      actorId: userId,
      workspaceId: workspace.id,
    });

    return { ...workspace, role: "OWNER" as const };
  });
}

export async function listMembers(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: {
      id: true,
      role: true,
      status: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return members;
}

export async function inviteMember(workspaceId: string, actorId: string, input: InviteMemberInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });

  const member = await prisma.$transaction(async (tx) => {
    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: input.email,
          name: input.email.split("@")[0] ?? input.email,
          status: "INVITED",
        },
      }));

    const alreadyMember = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });

    if (alreadyMember) {
      throw AppError.conflict("This person is already a member of the workspace.");
    }

    const isActiveAccount = user.status === "ACTIVE";

    return tx.workspaceMember.create({
      data: {
        workspaceId,
        userId: user.id,
        role: input.role,
        status: isActiveAccount ? "ACTIVE" : "INVITED",
        joinedAt: isActiveAccount ? new Date() : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  });

  await recordAuditEvent({
    action: "workspace.member_invited",
    entityType: "workspace_member",
    entityId: member.id,
    actorId,
    workspaceId,
    metadata: { email: input.email, role: input.role },
  });

  return member;
}

export async function updateMember(
  workspaceId: string,
  memberId: string,
  actorId: string,
  input: UpdateMemberInput
) {
  const member = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId } });

  if (!member) {
    throw AppError.notFound("Workspace member not found.");
  }

  if (member.role === "OWNER" && (input.role !== undefined || input.status === "REMOVED")) {
    const ownerCount = await prisma.workspaceMember.count({
      where: { workspaceId, role: "OWNER", status: "ACTIVE" },
    });

    if (ownerCount <= 1) {
      throw AppError.conflict("A workspace must always have at least one active owner.");
    }
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: {
      role: input.role,
      status: input.status,
      joinedAt: input.status === "ACTIVE" && !member.joinedAt ? new Date() : undefined,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  await recordAuditEvent({
    action: "workspace.member_updated",
    entityType: "workspace_member",
    entityId: memberId,
    actorId,
    workspaceId,
    metadata: { role: input.role, status: input.status },
  });

  return updated;
}
