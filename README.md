# DevTrack

Developer productivity platform: Kanban tasks, GitHub PR tracking, deployment logging, and
delivery metrics. Built as a real, deployable full-stack app — see
`DevTrack_Implementation_Document.pdf` for the full product spec, ERD, and roadmap.

**Status:** Phase 1 (Foundation) + Phase 2 (Auth, Workspace, RBAC) implemented. Kanban, GitHub
integration, deploy logs, realtime notifications, and metrics are not built yet (Phase 3+).

## Stack

- `apps/web` — Next.js 16 (App Router)
- `apps/api` — Express 5 REST API, Prisma ORM 7, PostgreSQL
- `packages/shared` — Zod schemas and TypeScript types shared by both apps
- Turborepo + npm workspaces

## Getting started

```bash
npm install
docker compose up -d              # starts local PostgreSQL on :5432
cp apps/api/.env.example apps/api/.env
cd apps/api && npx prisma migrate dev
cd ../.. && npm run dev            # web on :3000, api on :4000
```

## Auth model

- Email/password with bcrypt password hashing.
- Short-lived (15 min) JWT access tokens signed with `jose`, returned in the response body.
- Refresh tokens are opaque random strings; only their SHA-256 hash is stored in the
  `refresh_tokens` table. They rotate on every `/auth/refresh` call and are delivered as an
  httpOnly, secure, `sameSite=lax` cookie scoped to `/api/v1/auth`.
- Registering creates the user and a default workspace (`OWNER` role). Workspace invites for
  an email with no account yet create an `INVITED` user stub; registering with that email later
  "claims" the stub and activates their pending memberships instead of creating a second
  default workspace.
- GitHub OAuth login is deferred to the GitHub integration phase (Phase 4).

## RBAC

Roles are hierarchical: `OWNER > ADMIN > DEVELOPER > VIEWER`. `requireWorkspaceRole(minimum)`
(`apps/api/src/middleware/rbac.middleware.ts`) enforces the permission matrix from the
implementation doc on every workspace-scoped route.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run web + api in watch mode via Turborepo |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run check-types` | Typecheck all apps |
| `npm test` | Run API test suite (Vitest + Supertest) |

## Environment variables

See `apps/api/.env.example` for the full list (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `COOKIE_DOMAIN`).
