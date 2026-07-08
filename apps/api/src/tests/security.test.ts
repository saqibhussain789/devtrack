import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";
import { uniqueEmail } from "./test-utils";

describe("security headers", () => {
  it("applies helmet's protective headers and hides Express's fingerprint", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("auth rate limiting", () => {
  it("locks out repeated failed login attempts from the same client", async () => {
    const email = uniqueEmail("rate-limit");
    const attempt = () => request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password" });

    const results = [];
    for (let i = 0; i < 21; i++) {
      results.push(await attempt());
    }

    const unauthorized = results.filter((r) => r.status === 401);
    const rateLimited = results.filter((r) => r.status === 429);

    // The limiter allows 20 requests per window before blocking; since none
    // of these credentials are valid, every allowed request is a 401 and
    // everything past the 20th should be rejected before reaching auth logic.
    expect(unauthorized.length).toBe(20);
    expect(rateLimited.length).toBe(1);
    expect(rateLimited[0]?.body.error.code).toBe("RATE_LIMITED");
  });
});
