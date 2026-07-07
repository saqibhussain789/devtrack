import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { extractCookie, uniqueEmail } from "./test-utils";

const email = uniqueEmail("auth");
const password = "correct-horse-battery-staple";

afterAll(async () => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    await prisma.workspace.deleteMany({ where: { createdBy: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

describe("auth flow", () => {
  it("registers a new user and creates a default workspace", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Ada Lovelace", email, password });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.user.email).toBe(email);
    expect(extractCookie(res, "devtrack_rt")).toContain("devtrack_rt=");
  });

  it("rejects duplicate registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Ada Lovelace", email, password });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    const bad = await request(app).post("/api/v1/auth/login").send({ email, password: "wrong" });
    expect(bad.status).toBe(401);

    const good = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeTypeOf("string");
  });

  it("rotates the refresh token and rejects the old one after rotation", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    const oldCookie = extractCookie(login, "devtrack_rt");

    const refreshed = await request(app).post("/api/v1/auth/refresh").set("Cookie", oldCookie);
    expect(refreshed.status).toBe(200);
    const newCookie = extractCookie(refreshed, "devtrack_rt");
    expect(newCookie).not.toBe(oldCookie);

    const reuseAttempt = await request(app).post("/api/v1/auth/refresh").set("Cookie", oldCookie);
    expect(reuseAttempt.status).toBe(401);

    const stillWorks = await request(app).post("/api/v1/auth/refresh").set("Cookie", newCookie);
    expect(stillWorks.status).toBe(200);
  });

  it("revokes the refresh token on logout", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    const cookie = extractCookie(login, "devtrack_rt");

    const logout = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("returns the authenticated profile with workspace memberships from /me", async () => {
    const login = await request(app).post("/api/v1/auth/login").send({ email, password });
    const accessToken = login.body.data.accessToken;

    const me = await request(app).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
    expect(me.body.data.memberships).toHaveLength(1);
    expect(me.body.data.memberships[0].role).toBe("OWNER");
  });

  it("rejects requests with no access token", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
  });
});
