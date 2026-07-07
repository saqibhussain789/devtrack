import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Verifies a GitHub `X-Hub-Signature-256: sha256=<hex>` header against the raw
 * request body. Must run against the raw bytes, not the parsed/re-serialized
 * JSON body, since re-serialization can change whitespace and invalidate the HMAC.
 */
export function verifyGithubSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(`sha256=${expected}`);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
