import type { Response } from "express";
import { env, isProduction } from "../../config/env";
import { REFRESH_TOKEN_TTL_MS } from "./token.util";

export const REFRESH_COOKIE_NAME = "devtrack_rt";

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    domain: env.COOKIE_DOMAIN,
    path: "/api/v1/auth",
  });
}

export const OAUTH_STATE_COOKIE_NAME = "devtrack_gh_oauth_state";
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

/**
 * `sameSite: "lax"` still sends this cookie on GitHub's redirect back to our
 * callback, because a full-page redirect is a top-level GET navigation — Lax
 * only blocks cookies on cross-site subrequests (fetch/img/iframe), not on
 * top-level navigation, which is exactly how the OAuth callback arrives.
 */
export function setOAuthStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/v1/auth/github",
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

export function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/api/v1/auth/github",
  });
}
