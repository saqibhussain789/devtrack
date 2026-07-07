import type { CreateProjectInput } from "@repo/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { assertWorkspaceRole } from "../../middleware/rbac.middleware";
import { recordAuditEvent } from "../audit/audit.service";

const DEFAULT_STATUSES = [
  { name: "To Do", category: "TODO" as const, isDefault: true },
  { name: "In Progress", category: "IN_PROGRESS" as const, isDefault: false },
  { name: "Done", category: "DONE" as const, isDefault: false },
];

export async function listProjects(userId: string, workspaceId: string) {
  await assertWorkspaceRole(userId, workspaceId, "VIEWER");

  return prisma.project.findMany({
    where: { workspaceId },
    select: { id: true, name: true, key: true, description: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createProject(userId: string, input: CreateProjectInput) {
  await assertWorkspaceRole(userId, input.workspaceId, "ADMIN");

  const existingKey = await prisma.project.findUnique({
    where: { workspaceId_key: { workspaceId: input.workspaceId, key: input.key } },
  });

  if (existingKey) {
    throw AppError.conflict(`A project with key "${input.key}" already exists in this workspace.`);
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        key: input.key,
        description: input.description,
      },
    });

    await tx.taskStatus.createMany({
      data: DEFAULT_STATUSES.map((status, index) => ({
        projectId: created.id,
        name: status.name,
        category: status.category,
        sortOrder: index,
        isDefault: status.isDefault,
      })),
    });

    return created;
  });

  await recordAuditEvent({
    action: "project.create",
    entityType: "project",
    entityId: project.id,
    actorId: userId,
    workspaceId: input.workspaceId,
    projectId: project.id,
  });

  return project;
}

export async function getProjectBoard(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, key: true, description: true, status: true, workspaceId: true },
  });

  const statuses = await prisma.taskStatus.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      sortOrder: true,
      isDefault: true,
      tasks: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          taskNumber: true,
          title: true,
          priority: true,
          storyPoints: true,
          completedAt: true,
          sortOrder: true,
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return { project, statuses };
}
