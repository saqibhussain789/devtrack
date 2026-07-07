import { Router } from "express";
import { metricsQuerySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getProjectMetricsHandler } from "./metrics.controller";

// Mounted at "/projects" alongside project/github/deployment routes — all
// authenticated, so sharing the prefix is safe (see routes/index.ts).
const router = Router();

router.use(requireAuth);

router.get("/:id/metrics", requireProjectRole("VIEWER"), validate(metricsQuerySchema, "query"), getProjectMetricsHandler);

export default router;
