import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("metrics-owner");
const RUN_ID = Math.random().toString(36).slice(2);
const commitSha = (n: string) => `${RUN_ID}${n}`.padEnd(7, "0");

let ownerToken: string;
let workspaceId: string;
let projectId: string;
let doneStatusId: string;

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Metrics Owner");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  const project = await createTestProject(ownerToken, workspaceId, { key: "MET" });
  projectId = project.id;

  const board = await request(app)
    .get(`/api/v1/projects/${projectId}/board`)
    .set("Authorization", `Bearer ${ownerToken}`);
  doneStatusId = board.body.data.statuses.find((s: { category: string }) => s.category === "DONE").id;

  const task = await request(app)
    .post(`/api/v1/projects/${projectId}/tasks`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ title: "Completed work", storyPoints: 5 });

  await request(app)
    .patch(`/api/v1/tasks/${task.body.data.id}/move`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ statusId: doneStatusId, sortOrder: 1 });

  await request(app)
    .post(`/api/v1/projects/${projectId}/deployments`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ environment: "PROD", commitSha: commitSha("1") });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (user) {
    await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

describe("project metrics", () => {
  it("requires authentication", async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/metrics`);
    expect(res.status).toBe(401);
  });

  it("computes velocity, deploy frequency, and change failure rate from real data", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/metrics?days=30`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const { snapshot, weeklyVelocity } = res.body.data;

    expect(snapshot.velocityPoints).toBe(5);
    expect(snapshot.openPrCount).toBe(0);
    expect(Number(snapshot.deployFrequency)).toBeGreaterThan(0);
    expect(Number(snapshot.changeFailureRate)).toBe(0);
    expect(snapshot.mttrHours).toBeNull();
    expect(Number(snapshot.leadTimeHours)).toBe(0);

    expect(weeklyVelocity).toHaveLength(6);
    const totalWeeklyPoints = weeklyVelocity.reduce((sum: number, w: { points: number }) => sum + w.points, 0);
    expect(totalWeeklyPoints).toBe(5);
  });

  it("upserts the same snapshot row instead of duplicating it on repeat calls", async () => {
    await request(app)
      .get(`/api/v1/projects/${projectId}/metrics?days=30`)
      .set("Authorization", `Bearer ${ownerToken}`);
    await request(app)
      .get(`/api/v1/projects/${projectId}/metrics?days=30`)
      .set("Authorization", `Bearer ${ownerToken}`);

    const count = await prisma.metricSnapshot.count({ where: { projectId } });
    expect(count).toBe(1);
  });
});
