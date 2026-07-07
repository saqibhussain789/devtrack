import { Router } from "express";
import { createWorkspaceSchema, inviteMemberSchema, updateMemberSchema } from "@repo/shared";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireWorkspaceRole } from "../../middleware/rbac.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createWorkspaceHandler,
  inviteWorkspaceMember,
  listWorkspaceMembers,
  listWorkspaces,
  updateWorkspaceMember,
} from "./workspace.controller";

// Mounted at "/workspaces" in routes/index.ts. Scoping requireAuth to this
// prefix (rather than a blanket router.use() on a router mounted at "/") keeps
// it from intercepting requests meant for unrelated, differently-prefixed
// routers registered alongside it (e.g. the public GitHub webhook receiver).
const router = Router();

router.use(requireAuth);

router.get("/", listWorkspaces);
router.post("/", validate(createWorkspaceSchema), createWorkspaceHandler);

router.get("/:id/members", requireWorkspaceRole("VIEWER"), listWorkspaceMembers);
router.post("/:id/invites", requireWorkspaceRole("ADMIN"), validate(inviteMemberSchema), inviteWorkspaceMember);
router.patch(
  "/:id/members/:memberId",
  requireWorkspaceRole("ADMIN"),
  validate(updateMemberSchema),
  updateWorkspaceMember
);

export default router;
