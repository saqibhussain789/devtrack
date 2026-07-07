import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("task-owner");
const viewerEmail = uniqueEmail("task-viewer");

let ownerToken: string;
let viewerToken: string;
let workspaceId: string;
let projectId: string;
let doneStatusId: string;

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Task Owner");
  viewerToken = await registerAndGetToken(viewerEmail, "Task Viewer");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: viewerEmail, role: "VIEWER" });

  const project = await createTestProject(ownerToken, workspaceId, { key: "TASK" });
  projectId = project.id;

  const board = await request(app)
    .get(`/api/v1/projects/${projectId}/board`)
    .set("Authorization", `Bearer ${ownerToken}`);
  doneStatusId = board.body.data.statuses.find((s: { name: string }) => s.name === "Done").id;
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

describe("tasks", () => {
  it("creates a task in the project's default status with an incrementing task number", async () => {
    const first = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Set up CI" });

    expect(first.status).toBe(201);
    expect(first.body.data.taskNumber).toBe(1);
    expect(first.body.data.priority).toBe("MEDIUM");

    const second = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Add board UI", priority: "HIGH" });

    expect(second.status).toBe(201);
    expect(second.body.data.taskNumber).toBe(2);
  });

  it("blocks a VIEWER from creating tasks", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: "Should fail" });

    expect(res.status).toBe(403);
  });

  it("updates task fields", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Original title" });

    const updated = await request(app)
      .patch(`/api/v1/tasks/${created.body.data.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Updated title", storyPoints: 5 });

    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe("Updated title");
    expect(updated.body.data.storyPoints).toBe(5);
  });

  it("rejects an empty update payload", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Needs an update body" });

    const res = await request(app)
      .patch(`/api/v1/tasks/${created.body.data.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("sets completedAt when a task moves into a DONE-category status", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Ship it" });

    expect(created.body.data.completedAt).toBeNull();

    const moved = await request(app)
      .patch(`/api/v1/tasks/${created.body.data.id}/move`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ statusId: doneStatusId, sortOrder: 1 });

    expect(moved.status).toBe(200);
    expect(moved.body.data.completedAt).not.toBeNull();
  });

  it("blocks a VIEWER from moving tasks", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Stays put" });

    const res = await request(app)
      .patch(`/api/v1/tasks/${created.body.data.id}/move`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ statusId: doneStatusId, sortOrder: 1 });

    expect(res.status).toBe(403);
  });

  it("adds and lists comments on a task", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Discuss approach" });

    const comment = await request(app)
      .post(`/api/v1/tasks/${created.body.data.id}/comments`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ body: "Let's pair on this." });

    expect(comment.status).toBe(201);
    expect(comment.body.data.body).toBe("Let's pair on this.");

    const task = await request(app)
      .get(`/api/v1/tasks/${created.body.data.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(task.body.data.comments).toHaveLength(1);
    expect(task.body.data.comments[0].author.email).toBe(ownerEmail);
  });
});
