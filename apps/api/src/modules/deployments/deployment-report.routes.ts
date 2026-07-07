import { Router } from "express";
import { reportDeploymentSchema } from "@repo/shared";
import { validate } from "../../middleware/validate.middleware";
import { reportDeploymentHandler } from "./deployment.controller";

// Deliberately public — CI pipelines have no user session, so the deploy
// token in the X-Deploy-Token header IS the auth check (verified in
// deployment.service.ts), the same trust model as the GitHub webhook
// receiver. Mounted at its own "/deploy" prefix, NOT "/projects", so it never
// sits behind deployment.routes.ts's `router.use(requireAuth)` — a router-level
// requireAuth rejects unauthenticated requests before Express can even try
// matching them against a later router's routes (see routes/index.ts).
const router = Router();

router.post("/:projectId/report", validate(reportDeploymentSchema), reportDeploymentHandler);

export default router;
