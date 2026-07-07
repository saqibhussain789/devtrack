import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/app-error";
import { ApiResponse } from "../utils/api-response";
import { isProduction } from "../config/env";

export function notFoundHandler(req: Request, res: Response) {
  ApiResponse.error(res, req, 404, "NOT_FOUND", `Route ${req.method} ${req.path} does not exist.`);
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return ApiResponse.error(res, req, err.statusCode, err.code, err.message, err.fields);
  }

  if (err instanceof ZodError) {
    const fields = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return ApiResponse.error(res, req, 400, "VALIDATION_ERROR", "Request data is invalid.", fields);
  }

  console.error(`[${req.requestId}] Unhandled error:`, err);

  return ApiResponse.error(
    res,
    req,
    500,
    "INTERNAL_ERROR",
    isProduction ? "Something went wrong. Please try again." : String(err)
  );
}
