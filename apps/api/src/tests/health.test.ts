import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

describe("health checks", () => {
  it("GET /api/v1/health returns service info", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.data.service).toBe("devtrack-api");
  });

  it("GET /api/v1/ready confirms database connectivity", async () => {
    const res = await request(app).get("/api/v1/ready");

    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("connected");
  });
});
