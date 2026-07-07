import { Router } from "express";
import { createProjectSchema, createTaskSchema, listProjectsQuerySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createProjectHandler, getBoardHandler, listProjectsHandler } from "./project.controller";
import { createTaskHandler } from "../tasks/task.controller";

// Mounted at "/projects" in routes/index.ts — see workspace.routes.ts for why
// requireAuth is scoped to a prefixed router rather than applied blanket at "/".
const router = Router();

router.use(requireAuth);

router.get("/", validate(listProjectsQuerySchema, "query"), listProjectsHandler);
router.post("/", validate(createProjectSchema), createProjectHandler);

router.get("/:id/board", requireProjectRole("VIEWER"), getBoardHandler);
router.post("/:id/tasks", requireProjectRole("DEVELOPER"), validate(createTaskSchema), createTaskHandler);

export default router;
