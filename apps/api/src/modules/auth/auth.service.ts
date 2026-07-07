import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { slugify, uniqueSlugSuffix } from "../../utils/slug";
import { recordAuditEvent } from "../audit/audit.service";
import { createRefreshToken, hashToken, signAccessToken } from "./token.util";
import type { RegisterInput, LoginInput } from "@repo/shared";

const BCRYPT_ROUNDS = 12;

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string };
}

export async function createSession(userId: string, email: string, name: string, ctx: RequestContext): Promise<AuthResult> {
  const accessToken = await signAccessToken({ sub: userId, email });
  const refresh = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    },
  });

  return { accessToken, refreshToken: refresh.token, user: { id: userId, email, name } };
}

export async function registerUser(input: RegisterInput, ctx: RequestContext): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  // A user row can already exist as an INVITED stub (created by a workspace invite for an
  // email with no account yet) with no password set. Registering with that email "claims"
  // the stub instead of creating a brand-new default workspace for them.
  if (existing) {
    if (existing.passwordHash || existing.status !== "INVITED") {
      throw AppError.conflict("An account with this email already exists.");
    }

    const user = await prisma.$transaction(async (tx) => {
      const claimedUser = await tx.user.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
          status: "ACTIVE",
        },
      });

      await tx.workspaceMember.updateMany({
        where: { userId: existing.id, status: "INVITED" },
        data: { status: "ACTIVE", joinedAt: new Date() },
      });

      return claimedUser;
    });

    const session = await createSession(user.id, user.email, user.name, ctx);
    await recordAuditEvent({ action: "auth.invite_accepted", entityType: "user", entityId: user.id, actorId: user.id });
    return session;
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const baseSlug = slugify(input.name) || "workspace";

  const { user } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });

    let slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    // Extremely unlikely collision loop guard; unique index is the real safety net.
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    }

    const workspace = await tx.workspace.create({
      data: {
        name: `${input.name}'s Workspace`,
        slug,
        createdBy: createdUser.id,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: createdUser.id,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    return { user: createdUser, workspace };
  });

  const session = await createSession(user.id, user.email, user.name, ctx);

  await recordAuditEvent({
    action: "auth.register",
    entityType: "user",
    entityId: user.id,
    actorId: user.id,
  });

  return session;
}

export async function loginUser(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.passwordHash) {
    await recordAuditEvent({
      action: "auth.login_failed",
      entityType: "user",
      metadata: { email: input.email },
    });
    throw AppError.unauthorized("Invalid email or password.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    await recordAuditEvent({
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      actorId: user.id,
    });
    throw AppError.unauthorized("Invalid email or password.");
  }

  const session = await createSession(user.id, user.email, user.name, ctx);

  await recordAuditEvent({ action: "auth.login", entityType: "user", entityId: user.id, actorId: user.id });

  return session;
}

export async function refreshSession(rawToken: string, ctx: RequestContext): Promise<AuthResult> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw AppError.unauthorized("Session expired. Please log in again.");
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const session = await createSession(existing.user.id, existing.user.email, existing.user.name, ctx);

  await recordAuditEvent({
    action: "auth.token_refreshed",
    entityType: "user",
    entityId: existing.user.id,
    actorId: existing.user.id,
  });

  return session;
}

export async function logoutUser(rawToken: string | undefined, actorId?: string): Promise<void> {
  if (!rawToken) {
    return;
  }

  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (existing && !existing.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await recordAuditEvent({
      action: "auth.logout",
      entityType: "user",
      entityId: existing.userId,
      actorId: actorId ?? existing.userId,
    });
  }
}
