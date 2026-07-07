import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("notif-owner");
const assigneeEmail = uniqueEmail("notif-assignee");

let ownerToken: string;
let assigneeToken: string;
let assigneeId: string;
let workspaceId: string;
let projectId: string;

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Notif Owner");
  assigneeToken = await registerAndGetToken(assigneeEmail, "Notif Assignee");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  const invite = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: assigneeEmail, role: "DEVELOPER" });
  assigneeId = invite.body.data.user.id;

  const project = await createTestProject(ownerToken, workspaceId, { key: "NTF" });
  projectId = project.id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  for (const email of [ownerEmail, assigneeEmail]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

describe("task assignment notifications", () => {
  it("notifies the assignee when a task is created assigned to them", async () => {
    const task = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Fix the thing", assigneeId });
    expect(task.status).toBe(201);

    const list = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);

    expect(list.status).toBe(200);
    expect(list.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    const notification = list.body.data.notifications.find((n: { type: string }) => n.type === "task.assigned");
    expect(notification).toBeTruthy();
    expect(notification.message).toContain("NTF-");
  });

  it("does not notify when someone assigns a task to themselves", async () => {
    const before = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);
    const beforeCount = before.body.data.notifications.length;

    const ownerAsMember = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`);
    const ownerId = ownerAsMember.body.data.find((m: { user: { email: string } }) => m.user.email === ownerEmail).user
      .id;

    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Self-assigned task", assigneeId: ownerId });

    const after = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(after.body.data.notifications.length).toBe(beforeCount);
  });

  it("notifies on reassignment via update but not on unrelated field updates", async () => {
    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ title: "Needs reassignment" });
    const taskId = created.body.data.id;

    const before = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    const beforeUnread = before.body.data.unreadCount;

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ priority: "HIGH" });

    const afterUnrelatedUpdate = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    expect(afterUnrelatedUpdate.body.data.unreadCount).toBe(beforeUnread);

    await request(app)
      .patch(`/api/v1/tasks/${taskId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ assigneeId });

    const afterReassignment = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    expect(afterReassignment.body.data.unreadCount).toBe(beforeUnread + 1);
  });

  it("marks a single notification read, then all as read", async () => {
    const list = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    const [first] = list.body.data.notifications;

    const markOne = await request(app)
      .patch(`/api/v1/notifications/${first.id}/read`)
      .set("Authorization", `Bearer ${assigneeToken}`);
    expect(markOne.status).toBe(200);

    const afterOne = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    const updated = afterOne.body.data.notifications.find((n: { id: string }) => n.id === first.id);
    expect(updated.readAt).not.toBeNull();

    const markAll = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${assigneeToken}`);
    expect(markAll.status).toBe(200);

    const afterAllRead = await request(app)
      .get("/api/v1/notifications")
      .set("Authorization", `Bearer ${assigneeToken}`);
    expect(afterAllRead.body.data.unreadCount).toBe(0);
  });
});
