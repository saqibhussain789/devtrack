import { ApiResponse } from "../../utils/api-response";
import { asyncHandler } from "../../utils/async-handler";
import {
  createDeployment,
  generateDeployToken,
  listDeployments,
  reportDeployment,
} from "./deployment.service";

export const generateDeployTokenHandler = asyncHandler(async (req, res) => {
  const result = await generateDeployToken(req.project!.id, req.user!.id);
  ApiResponse.success(res, req, result, 201);
});

export const createDeploymentHandler = asyncHandler(async (req, res) => {
  const deployment = await createDeployment(req.project!.id, req.user!.id, req.body);
  ApiResponse.success(res, req, deployment, 201);
});

export const listDeploymentsHandler = asyncHandler(async (req, res) => {
  const { environment } = req.query as { environment?: "DEV" | "STAGING" | "PROD" };
  const deployments = await listDeployments(req.params.id as string, environment);
  ApiResponse.success(res, req, deployments);
});

export const reportDeploymentHandler = asyncHandler(async (req, res) => {
  const token = req.get("X-Deploy-Token");
  const deployment = await reportDeployment(req.params.projectId as string, token, req.body);
  res.status(200).json({ data: deployment });
});
