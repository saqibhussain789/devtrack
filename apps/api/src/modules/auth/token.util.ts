import { jwtVerify, SignJWT } from "jose";
import { env } from "../../config/env";
import { generateOpaqueToken, hashToken } from "../../utils/crypto";
import { AppError } from "../../utils/app-error";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret);

    if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
      throw AppError.unauthorized("Invalid access token.");
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    throw AppError.unauthorized("Invalid or expired access token.");
  }
}

export function createRefreshToken() {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

export { hashToken };
