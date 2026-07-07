import type { NextFunction, Request, Response } from "express";
import { roleAtLeast, type WorkspaceRole } from "@repo/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: { id: string; workspaceId: string; role: WorkspaceRole };
      project?: { id: string; workspaceId: string };
      task?: { id: string; projectId: string; workspaceId: string };
    }
  }
}

/**
 * Loads the caller's membership for a workspace and enforces a minimum role. The
 * Figure 2 permission matrix in the doc is fully hierarchical (OWNER > ADMIN >
 * DEVELOPER > VIEWER), so a single minimum-role check covers every documented
 * permission. Shared by every *Role middleware below regardless of which route
 * param identifies the resource.
 */
export async function assertWorkspaceRole(userId: string, workspaceId: string, minimumRole: WorkspaceRole) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw AppError.forbidden("You are not a member of this workspace.");
  }

  if (!roleAtLeast(membership.role, minimumRole)) {
    throw AppError.forbidden(`This action requires the ${minimumRole} role or higher.`);
  }

  return membership;
}

function readParam(req: Request, paramName: string): string {
  const raw = req.params[paramName];

  if (!raw || Array.isArray(raw)) {
    throw AppError.badRequest(`Missing route parameter "${paramName}".`);
  }

  return raw;
}

/** For routes where req.params[paramName] IS the workspace id. */
export function requireWorkspaceRole(minimumRole: WorkspaceRole, paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    try {
      const workspaceId = readParam(req, paramName);
      const membership = await assertWorkspaceRole(req.user.id, workspaceId, minimumRole);
      req.membership = { id: membership.id, workspaceId, role: membership.role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** For routes where req.params[paramName] is a project id; resolves its workspace first. */
export function requireProjectRole(minimumRole: WorkspaceRole, paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    try {
      const projectId = readParam(req, paramName);
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, workspaceId: true },
      });

      if (!project) {
        throw AppError.notFound("Project not found.");
      }

      const membership = await assertWorkspaceRole(req.user.id, project.workspaceId, minimumRole);
      req.membership = { id: membership.id, workspaceId: project.workspaceId, role: membership.role };
      req.project = project;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** For routes where req.params[paramName] is a task id; resolves its project + workspace first. */
export function requireTaskRole(minimumRole: WorkspaceRole, paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    try {
      const taskId = readParam(req, paramName);
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, projectId: true, project: { select: { workspaceId: true } } },
      });

      if (!task) {
        throw AppError.notFound("Task not found.");
      }

      const membership = await assertWorkspaceRole(req.user.id, task.project.workspaceId, minimumRole);
      req.membership = { id: membership.id, workspaceId: task.project.workspaceId, role: membership.role };
      req.task = { id: task.id, projectId: task.projectId, workspaceId: task.project.workspaceId };
      next();
    } catch (err) {
      next(err);
    }
  };
}
