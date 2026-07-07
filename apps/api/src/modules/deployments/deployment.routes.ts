import { Router } from "express";
import { createDeploymentSchema, listDeploymentsQuerySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createDeploymentHandler, generateDeployTokenHandler, listDeploymentsHandler } from "./deployment.controller";

// Mounted at "/projects" in routes/index.ts, alongside project.routes.ts and
// github.routes.ts. The CI-facing report endpoint lives in its own router at
// its own "/deploy" prefix (deployment-report.routes.ts) specifically so it
// never sits behind this router's blanket requireAuth — see routes/index.ts.
const router = Router();

router.use(requireAuth);

router.post("/:id/deploy-token", requireProjectRole("ADMIN"), generateDeployTokenHandler);
router.post(
  "/:id/deployments",
  requireProjectRole("DEVELOPER"),
  validate(createDeploymentSchema),
  createDeploymentHandler
);
router.get(
  "/:id/deployments",
  requireProjectRole("VIEWER"),
  validate(listDeploymentsQuerySchema, "query"),
  listDeploymentsHandler
);

export default router;
