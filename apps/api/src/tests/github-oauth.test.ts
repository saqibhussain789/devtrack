import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

// This dev/test environment has no real GitHub OAuth App registered (there's
// nothing to safely fake without adding an HTTP-mocking dependency this repo
// doesn't otherwise need), so these tests cover the two things fully
// verifiable without one: the feature is off by default until configured,
// and the callback's CSRF state check rejects a request that skipped
// /auth/github. The full happy path needs a real GITHUB_OAUTH_CLIENT_ID/
// SECRET and manual verification — see the README.
describe("github oauth", () => {
  it("returns a clear error instead of redirecting when not configured", async () => {
    const res = await request(app).get("/api/v1/auth/github");
    expect(res.status).toBe(400);
  });

  it("redirects the browser back to login with an error rather than a raw JSON error, since the callback is a page navigation", async () => {
    const withParams = await request(app).get("/api/v1/auth/github/callback?code=fake&state=fake");
    expect(withParams.status).toBe(302);
    expect(withParams.headers.location).toContain("/login?error=github_oauth_failed");

    const withoutParams = await request(app).get("/api/v1/auth/github/callback");
    expect(withoutParams.status).toBe(302);
    expect(withoutParams.headers.location).toContain("/login?error=github_oauth_failed");
  });
});
