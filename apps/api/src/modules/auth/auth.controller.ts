import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { generateOpaqueToken } from "../../utils/crypto";
import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  clearOAuthStateCookie,
  clearRefreshCookie,
  OAUTH_STATE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  setOAuthStateCookie,
  setRefreshCookie,
} from "./cookie.util";
import { loginUser, logoutUser, refreshSession, registerUser } from "./auth.service";
import { buildAuthorizeUrl, completeGithubLogin, isGithubOAuthConfigured } from "./github-oauth.service";

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

export const githubAuthorize = asyncHandler(async (_req, res) => {
  if (!isGithubOAuthConfigured()) {
    throw AppError.badRequest("GitHub sign-in is not configured on this server.");
  }

  const state = generateOpaqueToken();
  setOAuthStateCookie(res, state);
  res.redirect(buildAuthorizeUrl(state));
});

export const githubCallback = asyncHandler(async (req, res) => {
  const loginFailedUrl = `${env.FRONTEND_URL}/login?error=github_oauth_failed`;

  if (!isGithubOAuthConfigured()) {
    return res.redirect(loginFailedUrl);
  }

  const { code, state } = req.query as { code?: string; state?: string };
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE_NAME];
  clearOAuthStateCookie(res);

  if (!code || !state || !expectedState || state !== expectedState) {
    return res.redirect(loginFailedUrl);
  }

  try {
    const session = await completeGithubLogin(code, requestContext(req));
    setRefreshCookie(res, session.refreshToken);
    // The access token stays server-side here — the frontend's existing
    // silent-refresh-on-load (POST /auth/refresh, reading this same cookie)
    // picks the session up as soon as it lands on /dashboard.
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch {
    res.redirect(loginFailedUrl);
  }
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
