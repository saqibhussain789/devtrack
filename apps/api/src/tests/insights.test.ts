import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("insights-owner");
const REPO_OWNER = "acme-test";
const RUN_ID = Math.random().toString(36).slice(2);
const REPO_NAME = `insights-${RUN_ID}`;
const deliveryId = (n: string) => `delivery-insights-${n}-${RUN_ID}`;

let ownerToken: string;
let workspaceId: string;
let projectId: string;
let doneStatusId: string;
let staleTaskId: string;
let staleTaskNumber: number;

function sendWebhook(id: string, eventType: string, payload: unknown, secret: string) {
  const body = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return request(app)
    .post("/api/v1/webhooks/github")
    .set("X-GitHub-Delivery", id)
    .set("X-GitHub-Event", eventType)
    .set("X-Hub-Signature-256", signature)
    .send(payload);
}

function prPayload(taskNumber: number, prNumber: number, action: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    action,
    repository: { name: REPO_NAME, owner: { login: REPO_OWNER } },
    pull_request: {
      id: 900000 + prNumber,
      number: prNumber,
      title: `Fix thing INS-${taskNumber}`,
      html_url: `https://github.com/acme-test/${REPO_NAME}/pull/${prNumber}`,
      merged: false,
      merged_at: null,
      user: { login: "octocat" },
      head: { ref: `ins-${taskNumber}-fix-thing` },
      ...overrides,
    },
  };
}

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Insights Owner");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  const project = await createTestProject(ownerToken, workspaceId, { key: "INS" });
  projectId = project.id;

  const board = await request(app)
    .get(`/api/v1/projects/${projectId}/board`)
    .set("Authorization", `Bearer ${ownerToken}`);
  doneStatusId = board.body.data.statuses.find((s: { category: string }) => s.category === "DONE").id;

  const connect = await request(app)
    .post(`/api/v1/projects/${projectId}/repository`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ owner: REPO_OWNER, repo: REPO_NAME });
  const webhookSecret = connect.body.data.webhookSecret;

  // Task 1: marked DONE, its only linked PR is still open (never merged) — should be flagged.
  const staleTask = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Ship the thing" });
  staleTaskId = staleTask.body.data.id;
  staleTaskNumber = staleTask.body.data.taskNumber;

  await sendWebhook(deliveryId("1"), "pull_request", prPayload(staleTaskNumber, 1, "opened"), webhookSecret);

  await request(app)
    .patch(`/api/v1/tasks/${staleTaskId}/move`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ statusId: doneStatusId, sortOrder: 1 });

  // Task 2: marked DONE with a merged PR — should NOT be flagged.
  const mergedTask = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Ship the other thing" });
  const mergedTaskNumber = mergedTask.body.data.taskNumber;

  await sendWebhook(deliveryId("2"), "pull_request", prPayload(mergedTaskNumber, 2, "opened"), webhookSecret);
  await sendWebhook(
    deliveryId("3"),
    "pull_request",
    prPayload(mergedTaskNumber, 2, "closed", { merged: true, merged_at: new Date().toISOString() }),
    webhookSecret
  );

  await request(app)
    .patch(`/api/v1/tasks/${mergedTask.body.data.id}/move`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ statusId: doneStatusId, sortOrder: 2 });

  // Backdate PR #1's syncedAt to simulate it having gone quiet.
  await prisma.pullRequest.updateMany({
    where: { projectId, number: 1 },
    data: { syncedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
  });
});

afterAll(async () => {
  const repository = await prisma.gitHubRepository.findFirst({ where: { owner: REPO_OWNER, repo: REPO_NAME } });
  if (repository) {
    await prisma.webhookEvent.deleteMany({ where: { repositoryId: repository.id } });
    await prisma.pullRequest.deleteMany({ where: { repositoryId: repository.id } });
  }

  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (user) {
    await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

describe("at-risk insights", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/insights/at-risk`);
    expect(res.status).toBe(401);
  });

  it("flags PRs with no synced activity in the stale window, and not fresh ones", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/insights/at-risk?stalePrDays=5`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const { stalePrs } = res.body.data;
    expect(stalePrs).toHaveLength(1);
    expect(stalePrs[0].number).toBe(1);
    expect(stalePrs[0].idleDays).toBeGreaterThanOrEqual(10);
  });

  it("flags DONE tasks whose linked PRs never merged, and not ones with a merged PR", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/insights/at-risk`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const { doneWithoutMergedPr } = res.body.data;
    expect(doneWithoutMergedPr).toHaveLength(1);
    expect(doneWithoutMergedPr[0].id).toBe(staleTaskId);
  });
});
