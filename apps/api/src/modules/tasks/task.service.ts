import type { CreateCommentInput, CreateTaskInput, MoveTaskInput, UpdateTaskInput } from "@repo/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { recordAuditEvent } from "../audit/audit.service";
import { createNotification } from "../notifications/notification.service";

const TASK_DETAIL_SELECT = {
  id: true,
  projectId: true,
  taskNumber: true,
  title: true,
  description: true,
  priority: true,
  storyPoints: true,
  sortOrder: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  statusId: true,
  assignee: { select: { id: true, name: true, email: true } },
  reporter: { select: { id: true, name: true, email: true } },
  comments: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

/** Notifies the assignee, unless they're the one who just made the assignment. */
async function notifyAssignment(assigneeId: string | null, actorId: string, projectId: string, task: { id: string; taskNumber: number; title: string }) {
  if (!assigneeId || assigneeId === actorId) return;

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { key: true, workspaceId: true },
  });

  await createNotification({
    userId: assigneeId,
    workspaceId: project.workspaceId,
    projectId,
    type: "task.assigned",
    title: "You were assigned a task",
    message: `${project.key}-${task.taskNumber}: ${task.title}`,
    metadata: { taskId: task.id },
  });
}

export async function createTask(projectId: string, reporterId: string, input: CreateTaskInput) {
  const defaultStatus = await prisma.taskStatus.findFirst({ where: { projectId, isDefault: true } });

  if (!defaultStatus) {
    throw AppError.conflict("This project has no default status configured.");
  }

  const task = await prisma.$transaction(async (tx) => {
    const [{ _max: maxTaskNumber }, { _max: maxSortOrder }] = await Promise.all([
      tx.task.aggregate({ where: { projectId }, _max: { taskNumber: true } }),
      tx.task.aggregate({ where: { statusId: defaultStatus.id }, _max: { sortOrder: true } }),
    ]);

    return tx.task.create({
      data: {
        projectId,
        statusId: defaultStatus.id,
        reporterId,
        assigneeId: input.assigneeId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        storyPoints: input.storyPoints,
        taskNumber: (maxTaskNumber.taskNumber ?? 0) + 1,
        sortOrder: Number(maxSortOrder.sortOrder ?? 0) + 1,
      },
      select: TASK_DETAIL_SELECT,
    });
  });

  await recordAuditEvent({
    action: "task.create",
    entityType: "task",
    entityId: task.id,
    actorId: reporterId,
    projectId,
  });

  await notifyAssignment(task.assignee?.id ?? null, reporterId, projectId, task);

  return task;
}

export async function getTask(taskId: string) {
  return prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: TASK_DETAIL_SELECT });
}

export async function updateTask(taskId: string, actorId: string, input: UpdateTaskInput) {
  const previous = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { assigneeId: true } });

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority,
      storyPoints: input.storyPoints,
      assigneeId: input.assigneeId,
    },
    select: TASK_DETAIL_SELECT,
  });

  await recordAuditEvent({
    action: "task.update",
    entityType: "task",
    entityId: task.id,
    actorId,
    projectId: task.projectId,
    metadata: input,
  });

  if (input.assigneeId !== undefined && input.assigneeId !== previous.assigneeId) {
    await notifyAssignment(task.assignee?.id ?? null, actorId, task.projectId, task);
  }

  return task;
}

export async function moveTask(taskId: string, actorId: string, input: MoveTaskInput) {
  const [task, targetStatus] = await Promise.all([
    prisma.task.findUniqueOrThrow({ where: { id: taskId } }),
    prisma.taskStatus.findUniqueOrThrow({ where: { id: input.statusId } }),
  ]);

  if (targetStatus.projectId !== task.projectId) {
    throw AppError.badRequest("Target status does not belong to this task's project.");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      statusId: input.statusId,
      sortOrder: input.sortOrder,
      completedAt: targetStatus.category === "DONE" && !task.completedAt ? new Date() : undefined,
    },
    select: TASK_DETAIL_SELECT,
  });

  await recordAuditEvent({
    action: "task.move",
    entityType: "task",
    entityId: taskId,
    actorId,
    projectId: task.projectId,
    metadata: { statusId: input.statusId, sortOrder: input.sortOrder },
  });

  return updated;
}

export async function addComment(taskId: string, authorId: string, input: CreateCommentInput) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { projectId: true } });

  const comment = await prisma.taskComment.create({
    data: { taskId, authorId, body: input.body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });

  await recordAuditEvent({
    action: "task.comment",
    entityType: "task_comment",
    entityId: comment.id,
    actorId: authorId,
    projectId: task.projectId,
    metadata: { taskId },
  });

  return comment;
}
