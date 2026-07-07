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
