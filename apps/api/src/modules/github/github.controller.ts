import { ApiResponse } from "../../utils/api-response";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { connectRepository, listPullRequests, listWebhookEvents, processGithubWebhook } from "./github.service";

export const connectRepositoryHandler = asyncHandler(async (req, res) => {
  const repository = await connectRepository(req.project!.workspaceId, req.project!.id, req.user!.id, req.body);
  ApiResponse.success(res, req, repository, 201);
});

export const listPullRequestsHandler = asyncHandler(async (req, res) => {
  const pullRequests = await listPullRequests(req.params.id as string);
  ApiResponse.success(res, req, pullRequests);
});

export const listWebhookEventsHandler = asyncHandler(async (req, res) => {
  const events = await listWebhookEvents(req.params.id as string);
  ApiResponse.success(res, req, events);
});

export const receiveGithubWebhook = asyncHandler(async (req, res) => {
  const deliveryId = req.get("X-GitHub-Delivery");
  const eventType = req.get("X-GitHub-Event");
  const signature = req.get("X-Hub-Signature-256");

  if (!deliveryId || !eventType) {
    throw AppError.badRequest("Missing GitHub webhook headers.");
  }

  if (!req.rawBody) {
    throw AppError.badRequest("Missing request body.");
  }

  const result = await processGithubWebhook(deliveryId, eventType, signature, req.rawBody);
  res.status(result.status).json({ message: result.message });
});
