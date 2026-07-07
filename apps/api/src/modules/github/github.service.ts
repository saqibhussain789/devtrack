import type { ConnectRepositoryInput } from "@repo/shared";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { generateWebhookSecret, verifyGithubSignature } from "../../utils/crypto";
import { recordAuditEvent } from "../audit/audit.service";

const PROCESSED_PR_ACTIONS = new Set(["opened", "edited", "synchronize", "closed", "reopened"]);
const TASK_KEY_PATTERN = /\b([A-Za-z][A-Za-z0-9]{1,11})-(\d+)\b/g;

export async function connectRepository(
  workspaceId: string,
  projectId: string,
  actorId: string,
  input: ConnectRepositoryInput
) {
  const existing = await prisma.gitHubRepository.findUnique({
    where: { workspaceId_owner_repo: { workspaceId, owner: input.owner, repo: input.repo } },
  });

  const repository =
    existing ??
    (await prisma.gitHubRepository.create({
      data: {
        workspaceId,
        owner: input.owner,
        repo: input.repo,
        defaultBranch: input.defaultBranch,
        connectedBy: actorId,
        webhookSecret: generateWebhookSecret(),
      },
    }));

  await prisma.project.update({ where: { id: projectId }, data: { repositoryId: repository.id } });

  await recordAuditEvent({
    action: "github.repository_connected",
    entityType: "github_repository",
    entityId: repository.id,
    actorId,
    projectId,
    workspaceId,
    metadata: { owner: input.owner, repo: input.repo },
  });

  return {
    id: repository.id,
    owner: repository.owner,
    repo: repository.repo,
    defaultBranch: repository.defaultBranch,
    webhookSecret: repository.webhookSecret,
    webhookUrl: "/api/v1/webhooks/github",
  };
}

export async function listPullRequests(projectId: string) {
  return prisma.pullRequest.findMany({
    where: { projectId },
    orderBy: { syncedAt: "desc" },
    select: {
      id: true,
      number: true,
      title: true,
      url: true,
      state: true,
      authorLogin: true,
      mergedAt: true,
      syncedAt: true,
      task: { select: { id: true, taskNumber: true, title: true } },
    },
  });
}

export async function listWebhookEvents(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { repositoryId: true },
  });

  if (!project.repositoryId) {
    return [];
  }

  return prisma.webhookEvent.findMany({
    where: { repositoryId: project.repositoryId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, eventType: true, processedAt: true, error: true, createdAt: true },
  });
}

function parseTaskKey(text: string, candidateKeys: Set<string>): { key: string; taskNumber: number } | null {
  for (const match of text.matchAll(TASK_KEY_PATTERN)) {
    const key = match[1]!.toUpperCase();
    if (candidateKeys.has(key)) {
      return { key, taskNumber: Number(match[2]) };
    }
  }
  return null;
}

interface GithubPullRequestPayload {
  action: string;
  repository: { name: string; owner: { login: string } };
  pull_request: {
    id: number;
    number: number;
    title: string;
    html_url: string;
    merged: boolean;
    merged_at: string | null;
    user: { login: string };
    head: { ref: string };
  };
}

export interface WebhookResult {
  status: number;
  message: string;
}

/**
 * Persists the raw delivery first (idempotent on GitHub's delivery id), then
 * verifies the signature and processes it. Mirrors doc Figure 5: persist before
 * processing so retries and replays never lose data, and duplicate deliveries
 * are a no-op rather than double-processing.
 */
export async function processGithubWebhook(
  deliveryId: string,
  eventType: string,
  signatureHeader: string | undefined,
  rawBody: Buffer
): Promise<WebhookResult> {
  const alreadySeen = await prisma.webhookEvent.findUnique({ where: { deliveryId } });
  if (alreadySeen) {
    return { status: 200, message: "Delivery already processed." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw AppError.badRequest("Invalid JSON payload.");
  }

  const repoInfo = (payload as { repository?: { name?: string; owner?: { login?: string } } }).repository;
  if (!repoInfo?.name || !repoInfo.owner?.login) {
    throw AppError.badRequest("Payload is missing repository information.");
  }

  const candidates = await prisma.gitHubRepository.findMany({
    where: { owner: repoInfo.owner.login, repo: repoInfo.name },
  });

  const repository = candidates.find(
    (candidate) => candidate.webhookSecret && verifyGithubSignature(rawBody, signatureHeader, candidate.webhookSecret)
  );

  if (!repository) {
    throw AppError.unauthorized("Invalid webhook signature.");
  }

  await prisma.webhookEvent.create({
    data: { repositoryId: repository.id, deliveryId, eventType, payload: payload as object },
  });

  try {
    if (eventType === "pull_request") {
      await processPullRequestEvent(repository.id, payload as GithubPullRequestPayload);
    }

    await prisma.webhookEvent.update({ where: { deliveryId }, data: { processedAt: new Date() } });
    return { status: 200, message: "Webhook processed." };
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { deliveryId },
      data: { processedAt: new Date(), error: err instanceof Error ? err.message : String(err) },
    });
    // Signature was valid and the delivery is durably stored, so acknowledge
    // receipt rather than letting GitHub retry a request that already failed
    // downstream processing (retrying won't fix a bug in our own code).
    return { status: 200, message: "Webhook received but processing failed; see webhook event log." };
  }
}

async function processPullRequestEvent(repositoryId: string, payload: GithubPullRequestPayload) {
  if (!PROCESSED_PR_ACTIONS.has(payload.action)) {
    return;
  }

  const projects = await prisma.project.findMany({
    where: { repositoryId },
    select: { id: true, key: true },
  });

  if (projects.length === 0) {
    return;
  }

  const pr = payload.pull_request;
  const state = payload.action === "closed" ? (pr.merged ? "MERGED" : "CLOSED") : "OPEN";

  const candidateKeys = new Set(projects.map((p) => p.key));
  const parsed = parseTaskKey(pr.head.ref, candidateKeys) ?? parseTaskKey(pr.title, candidateKeys);
  const targetProject = parsed ? (projects.find((p) => p.key === parsed.key) ?? projects[0]!) : projects[0]!;

  const task = parsed
    ? await prisma.task.findUnique({
        where: { projectId_taskNumber: { projectId: targetProject.id, taskNumber: parsed.taskNumber } },
        select: { id: true },
      })
    : null;

  await prisma.pullRequest.upsert({
    where: { repositoryId_githubPrId: { repositoryId, githubPrId: BigInt(pr.id) } },
    create: {
      repositoryId,
      projectId: targetProject.id,
      taskId: task?.id,
      githubPrId: BigInt(pr.id),
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      state,
      authorLogin: pr.user.login,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    },
    update: {
      title: pr.title,
      state,
      taskId: task?.id,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      syncedAt: new Date(),
    },
  });

  await recordAuditEvent({
    action: `github.pull_request_${payload.action}`,
    entityType: "pull_request",
    entityId: String(pr.id),
    projectId: targetProject.id,
    metadata: { number: pr.number, state, taskId: task?.id },
  });
}
