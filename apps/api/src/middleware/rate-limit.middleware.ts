import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { ApiResponse } from "../utils/api-response";

function rateLimitedHandler(req: Request, res: Response) {
  ApiResponse.error(res, req, 429, "RATE_LIMITED", "Too many requests. Try again later.");
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedHandler,
});

/** Loose ceiling for all authenticated API traffic — catches runaway clients/scripts, not real usage. */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedHandler,
});

/**
 * For the webhook receiver and CI deploy-report endpoint: both are reachable
 * without a user session (their secret/token IS the auth), which makes them
 * the only routes where an attacker can cheaply brute-force credentials by
 * volume alone. Tighter than the general limiter, looser than auth, since a
 * real CI pipeline or GitHub redelivering webhooks can legitimately burst.
 */
export const publicIntegrationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitedHandler,
});
