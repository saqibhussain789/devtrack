import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/app-error";
import { env } from "../../config/env";
import { slugify, uniqueSlugSuffix } from "../../utils/slug";
import { recordAuditEvent } from "../audit/audit.service";
import { createSession, type AuthResult, type RequestContext } from "./auth.service";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

export function isGithubOAuthConfigured(): boolean {
  return Boolean(env.GITHUB_OAUTH_CLIENT_ID && env.GITHUB_OAUTH_CLIENT_SECRET);
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID!);
  url.searchParams.set("redirect_uri", env.GITHUB_OAUTH_CALLBACK_URL);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

interface GithubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL,
    }),
  });

  const data = (await res.json()) as { access_token?: string; error_description?: string };

  if (!res.ok || !data.access_token) {
    throw AppError.unauthorized(data.error_description ?? "GitHub did not return an access token.");
  }

  return data.access_token;
}

async function fetchGithubProfile(githubAccessToken: string) {
  const headers = { Authorization: `Bearer ${githubAccessToken}`, "User-Agent": "DevTrack" };

  const [profileRes, emailsRes] = await Promise.all([
    fetch(GITHUB_USER_URL, { headers }),
    fetch(GITHUB_EMAILS_URL, { headers }),
  ]);

  if (!profileRes.ok) {
    throw AppError.unauthorized("Unable to fetch your GitHub profile.");
  }

  const profile = (await profileRes.json()) as GithubProfile;
  const emails: GithubEmail[] = emailsRes.ok ? await emailsRes.json() : [];

  // GitHub's /user endpoint only returns `email` if the user made it public;
  // /user/emails (needs the user:email scope) is the reliable source, preferring
  // the primary verified address and falling back to any verified one.
  const primaryEmail =
    emails.find((e) => e.primary && e.verified)?.email ?? emails.find((e) => e.verified)?.email ?? profile.email;

  if (!primaryEmail) {
    throw AppError.badRequest("Your GitHub account has no verified email address to sign in with.");
  }

  return {
    githubId: String(profile.id),
    name: profile.name?.trim() || profile.login,
    avatarUrl: profile.avatar_url,
    email: primaryEmail,
  };
}

type GithubProfileResult = Awaited<ReturnType<typeof fetchGithubProfile>>;

/**
 * Finds a user by GitHub id first (repeat login), then by email (links an
 * existing account to GitHub and — like claiming an invite on register —
 * activates any pending workspace invites for that email), else creates a
 * new user + default workspace exactly like email/password registration.
 * GitHub sign-ins never set a passwordHash, so those accounts can only log
 * in via GitHub afterward.
 */
async function findOrCreateGithubUser(profile: GithubProfileResult) {
  const byGithubId = await prisma.user.findUnique({ where: { githubId: profile.githubId } });
  if (byGithubId) return byGithubId;

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: byEmail.id },
        data: { githubId: profile.githubId, avatarUrl: byEmail.avatarUrl ?? profile.avatarUrl, status: "ACTIVE" },
      });

      await tx.workspaceMember.updateMany({
        where: { userId: byEmail.id, status: "INVITED" },
        data: { status: "ACTIVE", joinedAt: new Date() },
      });

      return updated;
    });
  }

  const baseSlug = slugify(profile.name) || "workspace";

  const { user } = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { email: profile.email, name: profile.name, githubId: profile.githubId, avatarUrl: profile.avatarUrl },
    });

    let slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${uniqueSlugSuffix()}`;
    }

    const workspace = await tx.workspace.create({
      data: { name: `${profile.name}'s Workspace`, slug, createdBy: createdUser.id },
    });

    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: createdUser.id, role: "OWNER", status: "ACTIVE", joinedAt: new Date() },
    });

    return { user: createdUser, workspace };
  });

  return user;
}

export async function completeGithubLogin(code: string, ctx: RequestContext): Promise<AuthResult> {
  const githubAccessToken = await exchangeCodeForAccessToken(code);
  const profile = await fetchGithubProfile(githubAccessToken);
  const user = await findOrCreateGithubUser(profile);

  const session = await createSession(user.id, user.email, user.name, ctx);

  await recordAuditEvent({ action: "auth.github_login", entityType: "user", entityId: user.id, actorId: user.id });

  return session;
}
