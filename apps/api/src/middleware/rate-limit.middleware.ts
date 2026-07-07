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
