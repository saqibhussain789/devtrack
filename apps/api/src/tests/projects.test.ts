import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";
import { createTestProject, getPrimaryWorkspaceId, registerAndGetToken } from "./fixtures";

const ownerEmail = uniqueEmail("proj-owner");
const viewerEmail = uniqueEmail("proj-viewer");
const outsiderEmail = uniqueEmail("proj-outsider");

let ownerToken: string;
let viewerToken: string;
let workspaceId: string;

beforeAll(async () => {
  ownerToken = await registerAndGetToken(ownerEmail, "Project Owner");
  viewerToken = await registerAndGetToken(viewerEmail, "Project Viewer");
  workspaceId = await getPrimaryWorkspaceId(ownerToken);

  await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: viewerEmail, role: "VIEWER" });
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  for (const email of [ownerEmail, viewerEmail, outsiderEmail]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

describe("projects", () => {
  it("lets an ADMIN+ member create a project with default statuses", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ workspaceId, name: "Core Platform", key: "core" });

    expect(res.status).toBe(201);
    expect(res.body.data.key).toBe("CORE");

    const board = await request(app)
      .get(`/api/v1/projects/${res.body.data.id}/board`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(board.status).toBe(200);
    expect(board.body.data.statuses.map((s: { name: string }) => s.name)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
    expect(board.body.data.statuses[0].isDefault).toBe(true);
  });

  it("rejects a duplicate project key inside the same workspace", async () => {
    await createTestProject(ownerToken, workspaceId, { key: "DUP" });

    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ workspaceId, name: "Another", key: "DUP" });

    expect(res.status).toBe(409);
  });

  it("blocks a VIEWER from creating a project", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ workspaceId, name: "Not Allowed", key: "NOPE" });

    expect(res.status).toBe(403);
  });

  it("lets a VIEWER list and view projects read-only", async () => {
    const project = await createTestProject(ownerToken, workspaceId, { key: "VIEW" });

    const list = await request(app)
      .get(`/api/v1/projects?workspaceId=${workspaceId}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((p: { id: string }) => p.id === project.id)).toBe(true);

    const board = await request(app)
      .get(`/api/v1/projects/${project.id}/board`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(board.status).toBe(200);
  });

  it("rejects access to a project outside the caller's workspace", async () => {
    const outsiderToken = await registerAndGetToken(outsiderEmail, "Outsider");
    const project = await createTestProject(ownerToken, workspaceId, { key: "PRIV" });

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}/board`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });
});
