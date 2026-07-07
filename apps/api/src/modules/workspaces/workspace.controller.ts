import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  createWorkspace,
  inviteMember,
  listMembers,
  listWorkspacesForUser,
  updateMember,
} from "./workspace.service";

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await listWorkspacesForUser(req.user!.id);
  ApiResponse.success(res, req, workspaces);
});

export const createWorkspaceHandler = asyncHandler(async (req, res) => {
  const workspace = await createWorkspace(req.user!.id, req.body.name);
  ApiResponse.success(res, req, workspace, 201);
});

export const listWorkspaceMembers = asyncHandler(async (req, res) => {
  const members = await listMembers(req.params.id as string);
  ApiResponse.success(res, req, members);
});

export const inviteWorkspaceMember = asyncHandler(async (req, res) => {
  const member = await inviteMember(req.params.id as string, req.user!.id, req.body);
  ApiResponse.success(res, req, member, 201);
});

export const updateWorkspaceMember = asyncHandler(async (req, res) => {
  const member = await updateMember(
    req.params.id as string,
    req.params.memberId as string,
    req.user!.id,
    req.body
  );
  ApiResponse.success(res, req, member);
});
