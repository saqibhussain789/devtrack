import { Router } from "express";
import { atRiskQuerySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getAtRiskItemsHandler } from "./insights.controller";

// Mounted at "/projects" alongside project/github/deployment/metrics routes —
// all authenticated, so sharing the prefix is safe (see routes/index.ts).
const router = Router();

router.use(requireAuth);

router.get(
  "/:id/insights/at-risk",
  requireProjectRole("VIEWER"),
  validate(atRiskQuerySchema, "query"),
  getAtRiskItemsHandler
);

export default router;
