import { Router } from "express";
import { createCommentSchema, moveTaskSchema, updateTaskSchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireTaskRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import { addCommentHandler, getTaskHandler, moveTaskHandler, updateTaskHandler } from "./task.controller";

const router = Router();

router.use(requireAuth);

router.get("/tasks/:id", requireTaskRole("VIEWER"), getTaskHandler);
router.patch("/tasks/:id", requireTaskRole("DEVELOPER"), validate(updateTaskSchema), updateTaskHandler);
router.patch("/tasks/:id/move", requireTaskRole("DEVELOPER"), validate(moveTaskSchema), moveTaskHandler);
router.post("/tasks/:id/comments", requireTaskRole("DEVELOPER"), validate(createCommentSchema), addCommentHandler);

export default router;
