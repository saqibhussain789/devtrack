import { z } from "zod";
import { WORKSPACE_ROLES } from "../types/workspace-role";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required.").max(180),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(WORKSPACE_ROLES).default("DEVELOPER"),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z
  .object({
    role: z.enum(WORKSPACE_ROLES).optional(),
    status: z.enum(["ACTIVE", "REMOVED"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Provide a role or status to update.",
  });

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
