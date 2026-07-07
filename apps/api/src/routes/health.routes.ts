import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/app-error";
import { ApiResponse } from "../utils/api-response";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

router.get("/health", (req, res) => {
  ApiResponse.success(res, req, {
    service: "devtrack-api",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

router.get(
  "/ready",
  asyncHandler(async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Database is not reachable.");
    }
    ApiResponse.success(res, req, { database: "connected" });
  })
);

export default router;
