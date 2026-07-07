import type { NextFunction, Request, Response } from "express";
import { roleAtLeast, type WorkspaceRole } from "@repo/shared";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      membership?: { id: string; workspaceId: string; role: WorkspaceRole };
    }
  }
}

/**
 * Loads the caller's membership for the workspace identified by req.params[paramName]
 * and enforces a minimum role. The Figure 2 permission matrix in the doc is fully
 * hierarchical (OWNER > ADMIN > DEVELOPER > VIEWER), so a single minimum-role check
 * covers every documented permission.
 */
export function requireWorkspaceRole(minimumRole: WorkspaceRole, paramName = "id") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }

    const rawWorkspaceId = req.params[paramName];

    if (!rawWorkspaceId || Array.isArray(rawWorkspaceId)) {
      return next(AppError.badRequest(`Missing route parameter "${paramName}".`));
    }

    const workspaceId: string = rawWorkspaceId;

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: req.user.id } },
    });

    if (!membership || membership.status !== "ACTIVE") {
      return next(AppError.forbidden("You are not a member of this workspace."));
    }

    if (!roleAtLeast(membership.role, minimumRole)) {
      return next(AppError.forbidden(`This action requires the ${minimumRole} role or higher.`));
    }

    req.membership = { id: membership.id, workspaceId, role: membership.role };
    next();
  };
}
