import type { Response } from "supertest";

export function extractCookie(res: Response, name: string): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((entry) => entry.startsWith(`${name}=`));

  if (!cookie) {
    throw new Error(`Cookie ${name} was not set on the response.`);
  }

  return cookie.split(";")[0] as string;
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}@example.com`;
}
