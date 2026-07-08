import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("deploy-owner");
const viewerEmail = uniqueEmail("deploy-viewer");
const RUN_ID = Math.random().toString(36).slice(2);
const commitSha = (n: string) => `${RUN_ID}${n}`.padEnd(7, "0");

let ownerToken: string;
let viewerToken: string;
let workspaceId: string;
let projectId: string;
let deployToken: string;

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Deploy Owner");
  viewerToken = await registerAndGetToken(viewerEmail, "Deploy Viewer");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: viewerEmail, role: "VIEWER" });

  const project = await createTestProject(ownerToken, workspaceId, { key: "DPL" });
  projectId = project.id;

  const tokenRes = await request(app)
    .post(`/api/v1/projects/${projectId}/deploy-token`)
    .set("Authorization", `Bearer ${ownerToken}`);
  deployToken = tokenRes.body.data.deployToken;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  for (const email of [ownerEmail, viewerEmail]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

describe("deploy token", () => {
  it("returns a token to the connecting ADMIN", () => {
    expect(deployToken).toBeTypeOf("string");
    expect(deployToken.length).toBeGreaterThan(20);
  });

  it("blocks a VIEWER from generating a deploy token", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/deploy-token`)
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });
});

describe("CI deployment reporting", () => {
  it("rejects a report with a missing or invalid token", async () => {
    const missing = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .send({ environment: "STAGING", commitSha: commitSha("1"), status: "QUEUED" });
    expect(missing.status).toBe(401);

    const wrong = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", "wrong-token")
      .send({ environment: "STAGING", commitSha: commitSha("1"), status: "QUEUED" });
    expect(wrong.status).toBe(401);
  });

  it("progresses QUEUED -> RUNNING -> SUCCESS as one deployment row", async () => {
    const sha = commitSha("2");

    const queued = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", deployToken)
      .send({ environment: "STAGING", commitSha: sha, status: "QUEUED" });
    expect(queued.status).toBe(200);
    const deploymentId = queued.body.data.id;

    const running = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", deployToken)
      .send({ environment: "STAGING", commitSha: sha, status: "RUNNING" });
    expect(running.body.data.id).toBe(deploymentId);
    expect(running.body.data.startedAt).not.toBeNull();

    const success = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", deployToken)
      .send({ environment: "STAGING", commitSha: sha, status: "SUCCESS" });
    expect(success.body.data.id).toBe(deploymentId);
    expect(success.body.data.status).toBe("SUCCESS");
    expect(success.body.data.finishedAt).not.toBeNull();

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/deployments`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const rows = list.body.data.filter((d: { commitSha: string }) => d.commitSha === sha);
    expect(rows).toHaveLength(1);
  });

  it("starts a fresh row for a redeploy of the same commit after a terminal status", async () => {
    const sha = commitSha("3");

    await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", deployToken)
      .send({ environment: "PROD", commitSha: sha, status: "FAILED", failureReason: "boom" });

    const redeploy = await request(app)
      .post(`/api/v1/deploy/${projectId}/report`)
      .set("X-Deploy-Token", deployToken)
      .send({ environment: "PROD", commitSha: sha, status: "QUEUED" });

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/deployments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .query({ environment: "PROD" });

    const rows = list.body.data.filter((d: { commitSha: string }) => d.commitSha === sha);
    expect(rows).toHaveLength(2);
    expect(redeploy.body.data.id).not.toBe(rows.find((r: { status: string }) => r.status === "FAILED").id);
  });
});

describe("manual deployment logging", () => {
  it("blocks a VIEWER from logging a manual deployment", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/deployments`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ environment: "DEV", commitSha: commitSha("4") });

    expect(res.status).toBe(403);
  });

  it("lets the OWNER log a manual deployment as SUCCESS", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/deployments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ environment: "DEV", commitSha: commitSha("5") });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("SUCCESS");
    expect(res.body.data.triggeredBy.email).toBe(ownerEmail);
  });
});

describe("workspace-wide deployment log", () => {
  it("aggregates deployments across every project in the workspace, most recent first", async () => {
    const secondProject = await createTestProject(ownerToken, workspaceId, { key: "DPL2" });

    await request(app)
      .post(`/api/v1/projects/${secondProject.id}/deployments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ environment: "PROD", commitSha: commitSha("6") });

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/deployments`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const projectKeys = new Set(res.body.data.map((d: { project: { key: string } }) => d.project.key));
    expect(projectKeys.has("DPL")).toBe(true);
    expect(projectKeys.has("DPL2")).toBe(true);
    expect(res.body.data[0].commitSha).toBe(commitSha("6"));
  });

  it("blocks a non-member from reading the workspace deployment log", async () => {
    const outsiderEmail = uniqueEmail("deploy-outsider");
    const outsiderToken = await registerAndGetToken(outsiderEmail, "Deploy Outsider");

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/deployments`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);

    const outsider = await prisma.user.findUnique({ where: { email: outsiderEmail } });
    if (outsider) {
      await prisma.workspace.deleteMany({ where: { createdBy: outsider.id } });
      await prisma.user.delete({ where: { id: outsider.id } });
    }
  });
});
