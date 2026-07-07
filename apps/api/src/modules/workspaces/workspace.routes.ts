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

const router = Router();

router.use(requireAuth);

router.get("/workspaces", listWorkspaces);
router.post("/workspaces", validate(createWorkspaceSchema), createWorkspaceHandler);

router.get("/workspaces/:id/members", requireWorkspaceRole("VIEWER"), listWorkspaceMembers);
router.post(
  "/workspaces/:id/invites",
  requireWorkspaceRole("ADMIN"),
  validate(inviteMemberSchema),
  inviteWorkspaceMember
);
router.patch(
  "/workspaces/:id/members/:memberId",
  requireWorkspaceRole("ADMIN"),
  validate(updateMemberSchema),
  updateWorkspaceMember
);

export default router;
