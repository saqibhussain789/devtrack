import { Router } from "express";
import { connectRepositorySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { connectRepositoryHandler, listPullRequestsHandler, listWebhookEventsHandler } from "./github.controller";

// Mounted at "/projects" in routes/index.ts, alongside project.routes.ts (Express
// allows multiple routers at the same prefix). See workspace.routes.ts for why
// requireAuth is scoped to a prefixed router rather than applied blanket at "/".
const router = Router();

router.use(requireAuth);

router.post("/:id/repository", requireProjectRole("ADMIN"), validate(connectRepositorySchema), connectRepositoryHandler);
router.get("/:id/pull-requests", requireProjectRole("VIEWER"), listPullRequestsHandler);
router.get("/:id/webhook-events", requireProjectRole("ADMIN"), listWebhookEventsHandler);

export default router;
