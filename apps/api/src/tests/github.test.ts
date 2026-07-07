import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("gh-owner");
const viewerEmail = uniqueEmail("gh-viewer");
const REPO_OWNER = "acme-test";
const RUN_ID = Math.random().toString(36).slice(2);
const REPO_NAME = `widgets-${RUN_ID}`;
// Delivery ids are globally unique (like real GitHub delivery ids) and this
// suite runs against the shared local dev Postgres, not an ephemeral per-run
// database — so these must be unique per run, or a leftover row from a
// previous local run permanently short-circuits the idempotency check below.
const deliveryId = (n: string) => `delivery-${n}-${RUN_ID}`;

let ownerToken: string;
let viewerToken: string;
let workspaceId: string;
let projectId: string;
let webhookSecret: string;
let taskId: string;

function signPayload(payload: unknown, secret: string) {
  const body = JSON.stringify(payload);
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return { body, signature };
}

function sendWebhook(deliveryId: string, eventType: string, payload: unknown, secret: string) {
  const { signature } = signPayload(payload, secret);
  return request(app)
    .post("/api/v1/webhooks/github")
    .set("X-GitHub-Delivery", deliveryId)
    .set("X-GitHub-Event", eventType)
    .set("X-Hub-Signature-256", signature)
    .send(payload);
}

function prPayload(action: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    action,
    repository: { name: REPO_NAME, owner: { login: REPO_OWNER } },
    pull_request: {
      id: 555111,
      number: 7,
      title: "Fix login bug",
      html_url: "https://github.com/acme-test/widgets/pull/7",
      merged: false,
      merged_at: null,
      user: { login: "octocat" },
      head: { ref: "feature-branch" },
      ...overrides,
    },
  };
}

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "GitHub Owner");
  viewerToken = await registerAndGetToken(viewerEmail, "GitHub Viewer");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: viewerEmail, role: "VIEWER" });

  const project = await createTestProject(ownerToken, workspaceId, { key: "GH" });
  projectId = project.id;

  const task = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Fix login" });
  taskId = task.body.data.id;

  const connect = await request(app)
    .post(`/api/v1/projects/${projectId}/repository`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ owner: REPO_OWNER, repo: REPO_NAME });
  webhookSecret = connect.body.data.webhookSecret;
});

afterAll(async () => {
  // WebhookEvent.repositoryId is SET NULL (not cascaded) when its repository is
  // deleted, since it's an audit trail that should outlive the connection in
  // real usage — but that means test runs must clean these up explicitly, or
  // they accumulate in the shared local dev database across repeated runs.
  const repository = await prisma.gitHubRepository.findFirst({ where: { owner: REPO_OWNER, repo: REPO_NAME } });
  if (repository) {
    await prisma.webhookEvent.deleteMany({ where: { repositoryId: repository.id } });
    await prisma.pullRequest.deleteMany({ where: { repositoryId: repository.id } });
  }

  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  for (const email of [ownerEmail, viewerEmail]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

describe("github repository connection", () => {
  it("returns a webhook secret to the connecting ADMIN", () => {
    expect(webhookSecret).toBeTypeOf("string");
    expect(webhookSecret.length).toBeGreaterThan(20);
  });

  it("blocks a VIEWER from connecting a repository", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/repository`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ owner: REPO_OWNER, repo: "other-repo" });

    expect(res.status).toBe(403);
  });
});

describe("github webhook processing", () => {
  it("rejects a request with an invalid signature", async () => {
    const res = await sendWebhook(deliveryId("bad-sig"), "pull_request", prPayload("opened"), "wrong-secret");
    expect(res.status).toBe(401);
  });

  it("processes an opened PR and links it to a task by branch name", async () => {
    const res = await sendWebhook(
      deliveryId("1"),
      "pull_request",
      prPayload("opened", { head: { ref: "gh-1-fix-login" } }),
      webhookSecret
    );

    expect(res.status).toBe(200);

    const prs = await request(app)
      .get(`/api/v1/projects/${projectId}/pull-requests`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(prs.status).toBe(200);
    expect(prs.body.data).toHaveLength(1);
    expect(prs.body.data[0].state).toBe("OPEN");
    expect(prs.body.data[0].task.id).toBe(taskId);
  });

  it("is idempotent for a redelivered delivery id", async () => {
    const payload = prPayload("opened", { head: { ref: "gh-1-fix-login" } });

    await sendWebhook(deliveryId("1"), "pull_request", payload, webhookSecret);
    const second = await sendWebhook(deliveryId("1"), "pull_request", payload, webhookSecret);

    expect(second.status).toBe(200);
    expect(second.body.message).toMatch(/already processed/i);

    const events = await request(app)
      .get(`/api/v1/projects/${projectId}/webhook-events`)
      .set("Authorization", `Bearer ${ownerToken}`);
    // The redelivered "delivery-1" must not create a second row — persistence is
    // keyed on GitHub's delivery id, so a retry is a no-op, not a duplicate.
    expect(events.body.data).toHaveLength(1);
  });

  it("marks the pull request MERGED when closed with merged=true", async () => {
    const res = await sendWebhook(
      deliveryId("2"),
      "pull_request",
      prPayload("closed", { merged: true, merged_at: new Date().toISOString(), head: { ref: "gh-1-fix-login" } }),
      webhookSecret
    );

    expect(res.status).toBe(200);

    const prs = await request(app)
      .get(`/api/v1/projects/${projectId}/pull-requests`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(prs.body.data[0].state).toBe("MERGED");
    expect(prs.body.data[0].mergedAt).not.toBeNull();
  });
});
