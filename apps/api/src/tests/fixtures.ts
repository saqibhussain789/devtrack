import request from "supertest";
import app from "../app";

export const TEST_PASSWORD = "correct-horse-battery-staple";

export async function registerAndGetToken(email: string, name: string): Promise<string> {
  const res = await request(app).post("/api/v1/auth/register").send({ name, email, password: TEST_PASSWORD });
  return res.body.data.accessToken as string;
}

export async function getPrimaryWorkspaceId(accessToken: string): Promise<string> {
  const res = await request(app).get("/api/v1/workspaces").set("Authorization", `Bearer ${accessToken}`);
  return res.body.data[0].id as string;
}

export async function createTestProject(
  accessToken: string,
  workspaceId: string,
  overrides: Partial<{ name: string; key: string }> = {}
) {
  const res = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ workspaceId, name: overrides.name ?? "Test Project", key: overrides.key ?? "TST" });
  return res.body.data as { id: string; name: string; key: string };
}
