import { Router } from "express";
import { createCommentSchema, moveTaskSchema, updateTaskSchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTaskRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { addCommentHandler, getTaskHandler, moveTaskHandler, updateTaskHandler } from "./task.controller";

// Mounted at "/tasks" in routes/index.ts — see workspace.routes.ts for why
// requireAuth is scoped to a prefixed router rather than applied blanket at "/".
const router = Router();

router.use(requireAuth);

router.get("/:id", requireTaskRole("VIEWER"), getTaskHandler);
router.patch("/:id", requireTaskRole("DEVELOPER"), validate(updateTaskSchema), updateTaskHandler);
router.patch("/:id/move", requireTaskRole("DEVELOPER"), validate(moveTaskSchema), moveTaskHandler);
router.post("/:id/comments", requireTaskRole("DEVELOPER"), validate(createCommentSchema), addCommentHandler);

export default router;
