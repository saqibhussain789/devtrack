import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { uniqueEmail } from "./test-utils";

const password = "correct-horse-battery-staple";
const ownerEmail = uniqueEmail("owner");
const memberEmail = uniqueEmail("member");
const invitedEmail = uniqueEmail("invited-by-admin");
const outsiderEmail = uniqueEmail("outsider");

let ownerToken: string;
let memberToken: string;
let workspaceId: string;
let memberId: string;

async function register(email: string, name: string) {
  const res = await request(app).post("/api/v1/auth/register").send({ name, email, password });
  return res.body.data.accessToken as string;
}

beforeAll(async () => {
  ownerToken = await register(ownerEmail, "Workspace Owner");
  memberToken = await register(memberEmail, "Future Admin");

  const workspaces = await request(app)
    .get("/api/v1/workspaces")
    .set("Authorization", `Bearer ${ownerToken}`);
  workspaceId = workspaces.body.data[0].id;

  const invite = await request(app)
    .post(`/api/v1/workspaces/${workspaceId}/invites`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ email: memberEmail, role: "VIEWER" });
  memberId = invite.body.data.id;
});

afterAll(async () => {
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });

  for (const email of [ownerEmail, memberEmail, invitedEmail, outsiderEmail]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  }
});

describe("workspace RBAC", () => {
  it("lets the owner invite a member as VIEWER", () => {
    expect(memberId).toBeTypeOf("string");
  });

  it("blocks a VIEWER from inviting other members", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ email: invitedEmail, role: "VIEWER" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("blocks a VIEWER from changing member roles", async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(403);
  });

  it("lets the OWNER promote the VIEWER to ADMIN", async () => {
    const res = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("ADMIN");
  });

  it("lets the newly promoted ADMIN invite members", async () => {
    const res = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ email: invitedEmail, role: "VIEWER" });

    expect(res.status).toBe(201);
  });

  it("prevents demoting the last remaining OWNER", async () => {
    const ownerMembership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, role: "OWNER" },
    });

    const res = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${ownerMembership!.id}`)
      .set("Authorization", `Bearer ${memberToken}`)
      .send({ role: "DEVELOPER" });

    expect(res.status).toBe(409);
  });

  it("rejects access to a workspace the caller does not belong to", async () => {
    const outsiderToken = await register(outsiderEmail, "Outsider");

    const res = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(res.status).toBe(403);
  });
});
