import type { CreateDeploymentInput, ReportDeploymentInput } from "@repo/shared";
import type { DeploymentEnvironment } from "../../../generated/prisma";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { generateOpaqueToken, hashToken } from "../../utils/crypto";
import { recordAuditEvent } from "../audit/audit.service";
import { createNotification } from "../notifications/notification.service";

const IN_PROGRESS_STATUSES = ["QUEUED", "RUNNING"] as const;
const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELED"]);

const DEPLOYMENT_SELECT = {
  id: true,
  environment: true,
  commitSha: true,
  imageTag: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  failureReason: true,
  createdAt: true,
  triggeredBy: { select: { id: true, name: true, email: true } },
} as const;

/**
 * Rotates the project's CI deploy token. Only the plaintext returned here is
 * ever available — like the GitHub webhook secret, only a hash is persisted,
 * so a lost token means generating a new one, not recovering the old one.
 */
export async function generateDeployToken(projectId: string, actorId: string) {
  const token = generateOpaqueToken();

  await prisma.project.update({
    where: { id: projectId },
    data: { deployTokenHash: hashToken(token) },
  });

  await recordAuditEvent({
    action: "deployment.token_rotated",
    entityType: "project",
    entityId: projectId,
    actorId,
    projectId,
  });

  return { deployToken: token };
}

/**
 * Reports a deployment event from a CI pipeline, authenticated by the
 * project's deploy token rather than a user session (the pipeline has no
 * user to act as). Mirrors the GitHub webhook's trust model: the token/secret
 * IS the auth check, so this route is intentionally unauthenticated at the
 * Express layer and mounted away from any auth-gated router.
 *
 * A single CI job typically calls this more than once for the same
 * commit+environment (QUEUED -> RUNNING -> SUCCESS/FAILED): each call updates
 * the same in-progress row rather than creating a new one, so a job's status
 * progression reads as one deployment, not three. Once a deployment reaches a
 * terminal status, the next report for that commit+environment starts a new
 * row — a genuine redeploy is new history, not an overwrite of the old one.
 */
export async function reportDeployment(projectId: string, token: string | undefined, input: ReportDeploymentInput) {
  if (!token) {
    throw AppError.unauthorized("Missing deploy token.");
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, deployTokenHash: true, repositoryId: true, workspaceId: true, key: true },
  });

  if (!project?.deployTokenHash || hashToken(token) !== project.deployTokenHash) {
    throw AppError.unauthorized("Invalid deploy token.");
  }

  const inProgress = await prisma.deployment.findFirst({
    where: {
      projectId,
      environment: input.environment,
      commitSha: input.commitSha,
      status: { in: [...IN_PROGRESS_STATUSES] },
    },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const isTerminal = TERMINAL_STATUSES.has(input.status);

  const deployment = inProgress
    ? await prisma.deployment.update({
        where: { id: inProgress.id },
        data: {
          status: input.status,
          imageTag: input.imageTag ?? inProgress.imageTag,
          startedAt: inProgress.startedAt ?? (input.status !== "QUEUED" ? now : null),
          finishedAt: isTerminal ? now : null,
          failureReason: input.status === "FAILED" ? input.failureReason : null,
        },
        select: DEPLOYMENT_SELECT,
      })
    : await prisma.deployment.create({
        data: {
          projectId,
          repositoryId: project.repositoryId,
          environment: input.environment,
          commitSha: input.commitSha,
          imageTag: input.imageTag,
          status: input.status,
          startedAt: input.status !== "QUEUED" ? now : null,
          finishedAt: isTerminal ? now : null,
          failureReason: input.status === "FAILED" ? input.failureReason : null,
        },
        select: DEPLOYMENT_SELECT,
      });

  await recordAuditEvent({
    action: "deployment.reported",
    entityType: "deployment",
    entityId: deployment.id,
    projectId,
    metadata: { environment: input.environment, commitSha: input.commitSha, status: input.status },
  });

  // CI-reported deployments have no user to notify directly, so a failure alerts
  // everyone who can act on it — workspace admins and owners — rather than no one.
  if (input.status === "FAILED") {
    const admins = await prisma.workspaceMember.findMany({
      where: { workspaceId: project.workspaceId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.userId,
          workspaceId: project.workspaceId,
          projectId,
          type: "deployment.failed",
          title: "Deployment failed",
          message: `${project.key} · ${input.environment} · ${input.commitSha.slice(0, 10)}${input.failureReason ? ` — ${input.failureReason}` : ""}`,
          metadata: { deploymentId: deployment.id, environment: input.environment },
        })
      )
    );
  }

  return deployment;
}

/** Manual log entry for a deployment a person ran themselves, outside CI. */
export async function createDeployment(projectId: string, actorId: string, input: CreateDeploymentInput) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { repositoryId: true },
  });

  const now = new Date();

  const deployment = await prisma.deployment.create({
    data: {
      projectId,
      repositoryId: project.repositoryId,
      environment: input.environment,
      commitSha: input.commitSha,
      imageTag: input.imageTag,
      status: "SUCCESS",
      triggeredById: actorId,
      startedAt: now,
      finishedAt: now,
    },
    select: DEPLOYMENT_SELECT,
  });

  await recordAuditEvent({
    action: "deployment.logged_manually",
    entityType: "deployment",
    entityId: deployment.id,
    actorId,
    projectId,
    metadata: { environment: input.environment, commitSha: input.commitSha },
  });

  return deployment;
}

export async function listDeployments(projectId: string, environment?: DeploymentEnvironment) {
  return prisma.deployment.findMany({
    where: { projectId, ...(environment ? { environment } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: DEPLOYMENT_SELECT,
  });
}
