import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import { createProject, getProjectBoard, listProjects } from "./project.service";

export const listProjectsHandler = asyncHandler(async (req, res) => {
  const { workspaceId } = req.query as { workspaceId: string };
  const projects = await listProjects(req.user!.id, workspaceId);
  ApiResponse.success(res, req, projects);
});

export const createProjectHandler = asyncHandler(async (req, res) => {
  const project = await createProject(req.user!.id, req.body);
  ApiResponse.success(res, req, project, 201);
});

export const getBoardHandler = asyncHandler(async (req, res) => {
  const board = await getProjectBoard(req.params.id as string);
  ApiResponse.success(res, req, board);
});
