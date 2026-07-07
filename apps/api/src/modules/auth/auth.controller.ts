import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "./cookie.util";
import { loginUser, logoutUser, refreshSession, registerUser } from "./auth.service";

function requestContext(req: Request) {
  return { userAgent: req.get("user-agent") ?? undefined, ipAddress: req.ip };
}

export const register = asyncHandler(async (req, res) => {
  const session = await registerUser(req.body, requestContext(req));
  setRefreshCookie(res, session.refreshToken);
  ApiResponse.success(res, req, { accessToken: session.accessToken, user: session.user }, 201);
});

export const login = asyncHandler(async (req, res) => {
  const session = await loginUser(req.body, requestContext(req));
  setRefreshCookie(res, session.refreshToken);
  ApiResponse.success(res, req, { accessToken: session.accessToken, user: session.user });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    throw AppError.unauthorized("No active session found.");
  }

  const session = await refreshSession(token, requestContext(req));
  setRefreshCookie(res, session.refreshToken);
  ApiResponse.success(res, req, { accessToken: session.accessToken, user: session.user });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  await logoutUser(token, req.user?.id);
  clearRefreshCookie(res);
  ApiResponse.success(res, req, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
      workspaceMembers: {
        where: { status: "ACTIVE" },
        select: {
          role: true,
          workspace: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) {
    throw AppError.unauthorized("User no longer exists.");
  }

  const { workspaceMembers, ...profile } = user;

  ApiResponse.success(res, req, {
    ...profile,
    memberships: workspaceMembers.map((m) => ({
      role: m.role,
      workspace: m.workspace,
    })),
  });
});
