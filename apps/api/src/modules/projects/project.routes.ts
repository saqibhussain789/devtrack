import { Router } from "express";
import { createProjectSchema, createTaskSchema, listProjectsQuerySchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireProjectRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createProjectHandler, getBoardHandler, listProjectsHandler } from "./project.controller";
import { createTaskHandler } from "../tasks/task.controller";

const router = Router();

router.use(requireAuth);

router.get("/projects", validate(listProjectsQuerySchema, "query"), listProjectsHandler);
router.post("/projects", validate(createProjectSchema), createProjectHandler);

router.get("/projects/:id/board", requireProjectRole("VIEWER"), getBoardHandler);
router.post(
  "/projects/:id/tasks",
  requireProjectRole("DEVELOPER"),
  validate(createTaskSchema),
  createTaskHandler
);

export default router;
