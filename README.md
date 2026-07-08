# DevTrack

DevTrack is a developer productivity platform: Kanban task boards, GitHub pull request
tracking, deployment logging, realtime notifications, and delivery metrics — all in one
dashboard. It's built as a real, deployable full-stack app. The full product spec, ERD, and
phase roadmap live in `DevTrack_Implementation_Document.pdf`.

## Project status

Built phase-by-phase against the implementation doc's roadmap:

| Phase | What it delivers | Status |
| --- | --- | --- |
| 1 | Foundation — Prisma schema, Docker Postgres, CI, health checks | ✅ Done |
| 2 | Auth (email/password, JWT + refresh rotation), workspaces, RBAC | ✅ Done |
| 3 | Kanban board — projects, tasks, drag-and-drop, comments | ✅ Done |
| 4 | GitHub integration — repo connect, signed webhooks, PR sync, task linking | ✅ Done |
| 5 | Deployment log — CI-reported deployment status, manual logging | ✅ Done |
| 6 | Realtime notifications (Socket.IO), metrics dashboard, GitHub OAuth login | ✅ Done |
| 7 | Hardening & launch (security pass, prod config) | ✅ Done |

## Feature overview (what's implemented today)

- **Auth**: register/login with bcrypt-hashed passwords, short-lived JWT access tokens, opaque
  refresh tokens (rotated every use, hashed at rest, delivered via httpOnly cookie).
- **Workspaces & RBAC**: every user gets a default workspace on registration; invite teammates
  by email; roles (`OWNER > ADMIN > DEVELOPER > VIEWER`) are enforced server-side on every
  workspace-, project-, and task-scoped route.
- **Kanban**: create projects, drag-and-drop tasks across status columns, assign teammates,
  comment on tasks.
- **GitHub integration**: connect a GitHub repository to a project, receive signed webhooks
  (HMAC-SHA256 verified), automatically sync pull request state (open/closed/merged) and link
  PRs to tasks by branch name or title (e.g. a branch called `dev-12-fix-login` links to task
  `DEV-12`).
- **Deployment log**: generate a CI token per project, have your pipeline report
  queued/running/success/failed deployment status per environment (dev/staging/prod), or log a
  manual deployment from the dashboard.
- **Realtime notifications**: a Socket.IO connection pushes task assignments, PR
  opened/merged, and deployment failures to the browser the instant they happen, backed by a
  persistent notification inbox (bell icon in the dashboard header).
- **Metrics dashboard**: per-project velocity, open PR count, deploy frequency, change failure
  rate, mean time to recovery, and average deploy duration over a trailing window, plus a
  6-week velocity trend chart.
- **GitHub OAuth login**: "Continue with GitHub" on login/register, in addition to
  email/password.

## Stack

- `apps/web` — Next.js 16 (App Router), React 19, Tailwind CSS v4
- `apps/api` — Express 5 REST API, Prisma ORM 7 (`@prisma/adapter-pg` driver adapter), PostgreSQL 18, Socket.IO
- `packages/shared` — Zod schemas and TypeScript types shared by both apps
- Turborepo + npm workspaces for the monorepo
- Vitest + Supertest for API tests

## Prerequisites

- **Node.js 20 or newer** and **npm** (this project uses npm workspaces)
- **Docker Desktop** (runs local PostgreSQL — no local Postgres install needed)
- **Git**

---

## Installing on Windows

You can run DevTrack directly on Windows, but **WSL2 is strongly recommended** — this stack
(Turborepo, Prisma, native file watching) behaves more predictably on a Linux filesystem, and
it's what Docker Desktop uses under the hood on Windows anyway. Native-Windows steps are
included below as an alternative if you'd rather not use WSL2.

### Option A — WSL2 (recommended)

1. **Install WSL2** (skip if already installed). Open PowerShell **as Administrator** and run:
   ```powershell
   wsl --install
   ```
   Restart when prompted. This installs Ubuntu by default.

2. **Install Docker Desktop for Windows** from https://www.docker.com/products/docker-desktop/.
   During setup, ensure **"Use the WSL 2 based engine"** is checked (it's the default). After
   install, go to *Settings → Resources → WSL Integration* and enable integration for your
   Ubuntu distro.

3. **Open your WSL2 terminal** (search "Ubuntu" in the Start menu) and install Node.js 20 via
   nvm, so version switching is easy and you avoid Windows/Linux path conflicts:
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc
   nvm install 20
   nvm use 20
   node --version   # confirm v20.x
   ```

4. **Clone the repo inside the Linux filesystem** (not `/mnt/c/...`) — this matters for file
   watching performance:
   ```bash
   cd ~
   git clone <your-repo-url> devtrack
   cd devtrack
   ```

5. Continue with the **"All platforms"** steps below from inside this WSL2 terminal.

### Option B — Native Windows (PowerShell)

1. Install **Node.js 20 LTS** from https://nodejs.org (choose the Windows installer).
2. Install **Docker Desktop for Windows** from https://www.docker.com/products/docker-desktop/
   and make sure it's running (check the whale icon in the system tray).
3. Install **Git for Windows** from https://git-scm.com/download/win.
4. Open **PowerShell** and clone the repo:
   ```powershell
   git clone <your-repo-url> devtrack
   cd devtrack
   ```
5. Continue with the **"All platforms"** steps below — every command works the same in
   PowerShell as in bash/zsh.

---

## All platforms — install and run

From the repo root (WSL2 terminal, PowerShell, or macOS/Linux shell — same commands
everywhere):

```bash
# 1. Install dependencies for every workspace (web, api, shared)
npm install

# 2. Start PostgreSQL in Docker (runs on localhost:5432)
docker compose up -d

# 3. Create your local API environment file
cp apps/api/.env.example apps/api/.env
# On native Windows PowerShell, use instead:
#   copy apps\api\.env.example apps\api\.env

# 4. Apply the database schema
cd apps/api
npx prisma migrate dev
cd ../..

# 5. Run both apps in dev mode (web on :3000, api on :4000)
npm run dev
```

Then open **http://localhost:3000**, register an account, and you'll land on your default
workspace's dashboard.

### Verifying Docker Postgres is up

```bash
docker compose ps
```

You should see `devtrack-postgres` with status `Up`. If port 5432 is already in use (e.g. by a
locally installed Postgres), stop that service or change the port mapping in
`docker-compose.yml` and update `DATABASE_URL` in `apps/api/.env` to match.

### Stopping / resetting the database container

```bash
docker compose down        # stop the container, keep data
docker compose down -v     # stop the container AND delete the data volume (destructive)
```

---

## Environment variables

`apps/api/.env.example` is the source of truth — copy it to `apps/api/.env` and adjust as
needed:

| Variable | Purpose | Default (dev) |
| --- | --- | --- |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | Port the Express API listens on | `4000` |
| `DATABASE_URL` | Postgres connection string | `postgresql://devtrack:devtrack@localhost:5432/devtrack` |
| `JWT_ACCESS_SECRET` | Signs access tokens — use a long random string, unique per environment | *(placeholder, must be changed)* |
| `JWT_REFRESH_SECRET` | Signs refresh-token hashing — same requirement | *(placeholder, must be changed)* |
| `COOKIE_DOMAIN` | Domain the refresh-token cookie is scoped to | unset (fine for localhost) |
| `CORS_ORIGIN` | Origin allowed to call the API with credentials | `http://localhost:3000` |
| `FRONTEND_URL` | Where the browser is redirected after GitHub OAuth login | `http://localhost:3000` |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App client ID (optional — hides "Continue with GitHub" if unset) | unset |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App client secret | unset |
| `GITHUB_OAUTH_CALLBACK_URL` | Must match the OAuth App's callback URL exactly | `http://localhost:4000/api/v1/auth/github/callback` |

Generate a strong random secret for the JWT variables, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The web app talks to the API at `http://localhost:4000/api/v1` by default. To point it
elsewhere, create `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

---

## Auth model

- Email/password with bcrypt password hashing (`bcryptjs`, no native bindings — works
  identically on Windows, macOS, and Linux).
- Short-lived (15 min) JWT access tokens signed with `jose`, returned in the response body and
  held in memory on the client.
- Refresh tokens are opaque random strings; only their SHA-256 hash is stored in the
  `refresh_tokens` table. They rotate on every `/auth/refresh` call and are delivered as an
  httpOnly, secure, `sameSite=lax` cookie scoped to `/api/v1/auth`.
- Registering creates the user and a default workspace (`OWNER` role). Workspace invites for an
  email with no account yet create an `INVITED` user stub; registering with that email later
  "claims" the stub and activates their pending memberships instead of creating a second
  default workspace. Logging in via GitHub with a matching email does the same claim/link.
- GitHub OAuth accounts never get a `passwordHash` — they can only sign in via GitHub.

## RBAC

Roles are hierarchical: `OWNER > ADMIN > DEVELOPER > VIEWER`. Middleware in
`apps/api/src/middleware/rbac.middleware.ts` (`requireWorkspaceRole`, `requireProjectRole`,
`requireTaskRole`) resolves the caller's membership for the relevant workspace and enforces a
minimum role on every workspace-, project-, and task-scoped route.

## GitHub integration

1. From a project's board page, connect a repository (owner/repo) — requires `ADMIN` role.
   You'll get a one-time webhook secret.
2. On GitHub: repo → *Settings → Webhooks → Add webhook*. Set the payload URL to
   `<your-api-url>/api/v1/webhooks/github`, content type `application/json`, paste in the
   secret, and select just the **Pull requests** event.
3. Since GitHub needs a publicly reachable URL to deliver webhooks, a local dev API isn't
   directly reachable — use a tunnel like `ngrok http 4000` and use the ngrok URL as the
   payload URL if you want to test against a real GitHub repo.

Pull requests are matched to tasks by parsing a task key (e.g. `DEV-12`) out of the PR's branch
name or title.

## Deployment log / CI reporting

1. From a project's board page, generate a CI deploy token — requires `ADMIN` role. Shown once.
2. Have your CI pipeline report status as the deployment progresses:
   ```bash
   curl -X POST http://localhost:4000/api/v1/deploy/<projectId>/report \
     -H "X-Deploy-Token: <token>" \
     -H "Content-Type: application/json" \
     -d '{"environment":"PROD","commitSha":"<sha>","status":"SUCCESS"}'
   ```
   Valid `status` values: `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELED`. Repeated calls
   for the same commit + environment update one deployment record through its lifecycle;
   reporting again after a terminal status starts a new record (a redeploy).

## Realtime notifications

The dashboard opens a Socket.IO connection authenticated with the same access token used for
REST calls. You're notified live (and it's saved to your notification inbox — the bell icon in
the header) when:

- you're assigned a task,
- a pull request linked to one of your tasks is opened or merged,
- a CI-reported deployment fails (sent to workspace `OWNER`/`ADMIN` members, since a CI pipeline
  has no specific user to notify).

No setup required — it works out of the box in dev and only needs `CORS_ORIGIN` to match your
frontend's origin in other environments.

## Metrics dashboard

Each project has a "View metrics →" link on its board page showing, over a trailing 30-day
window: velocity (story points completed), open PR count, deploy frequency, change failure
rate, mean time to recovery, and average deploy duration, plus a 6-week velocity trend chart.
Numbers are computed on request and cached in the `metric_snapshots` table.

Two of these are pragmatic approximations given what the schema tracks — no incident model and
no commit-authored timestamp exist to compute the strict DORA definitions:

- **Avg. deploy duration** stands in for DORA "lead time for changes" (commit authored → live),
  measuring deployment pipeline duration (queued → finished) instead.
- **MTTR** is the time from a failed deployment to the next successful deployment of the *same
  environment*, rather than time-to-resolve a tracked incident.

## GitHub OAuth login

Optional — the "Continue with GitHub" button is hidden automatically until configured.

1. Go to https://github.com/settings/developers → **New OAuth App**.
2. Homepage URL: `http://localhost:3000`. Authorization callback URL: must exactly match
   `GITHUB_OAUTH_CALLBACK_URL` (default `http://localhost:4000/api/v1/auth/github/callback`).
   GitHub OAuth Apps allow `localhost` callback URLs, so no tunnel is needed for this (unlike
   the GitHub webhook receiver above).
3. Copy the generated Client ID and Client Secret into `apps/api/.env` as
   `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`, then restart the API.

## Security hardening

- **Headers**: [`helmet`](https://helmetjs.github.io/) is applied to every response (HSTS,
  `X-Content-Type-Options: nosniff`, no `X-Powered-By`, etc.). Content-Security-Policy is left
  off at the API layer — this server only ever returns JSON, so a CSP header has nothing to
  constrain; the browser-facing security policy belongs to the Next.js app instead.
- **Rate limiting**: three tiers, all IP-based —
  - `authRateLimiter` (20 req/15 min) on `/auth/*` — the most sensitive, credential-guessing surface.
  - `apiRateLimiter` (600 req/15 min) applied globally as a backstop against runaway clients/scripts.
  - `publicIntegrationRateLimiter` (120 req/5 min) on the GitHub webhook and CI deploy-report
    endpoints specifically — both are reachable without a user session (their secret/token *is*
    the auth check), which makes them the one place an attacker can cheaply brute-force
    credentials by request volume alone.
- **Body size limits**: JSON/urlencoded bodies capped at 1 MB to blunt large-payload abuse.
- **`trust proxy`**: enabled in production only, so rate limiting and request logging see the
  real client IP instead of a reverse proxy's, when deployed behind one (Render, Railway, Fly,
  a load balancer, etc.).
- **Graceful shutdown**: `SIGTERM`/`SIGINT` stop new connections, close the Socket.IO server,
  disconnect Prisma, and exit — so a container orchestrator's redeploy/scale-down doesn't cut
  off in-flight requests or leak Postgres connections. A 10s watchdog force-exits if something
  hangs.
- **Dependency audit**: CI runs `npm audit --audit-level=high` on every push, so a newly
  introduced high/critical vulnerability fails the build. Two moderate advisories are currently
  known and accepted rather than chased: `@prisma/dev` (a transitive dependency of the `prisma`
  CLI, dev-tooling only, never runs in a deployed request path) and a `postcss` copy bundled
  *inside* Next.js's own build tooling (fixing it would mean downgrading Next by 7 major
  versions — the CVE only matters when processing untrusted CSS at build time, which this repo
  never does).

## Production deployment

Both apps have multi-stage Dockerfiles. **Build from the repo root**, not the app directory —
npm workspaces need the root `package.json`/lockfile and the `@repo/shared` package alongside
whichever app you're building:

```bash
# API
docker build -f apps/api/Dockerfile -t devtrack-api .
docker run --rm -p 4000:4000 --env-file apps/api/.env devtrack-api

# Web — NEXT_PUBLIC_API_URL is baked into the client bundle at build time, not read at
# container startup, so it's a build arg rather than a runtime env var
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://your-api.example.com/api/v1 \
  -t devtrack-web .
docker run --rm -p 3000:3000 devtrack-web
```

Applying database migrations is a separate release step, run once per deploy — not something
the container does on every boot (which would race across multiple replicas):

```bash
docker run --rm --env-file apps/api/.env devtrack-api npx prisma migrate deploy
```

In production, also set: `NODE_ENV=production`, real `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
values (see the random-secret command above), `CORS_ORIGIN` to your actual frontend origin, and
`FRONTEND_URL`/`GITHUB_OAUTH_CALLBACK_URL` if GitHub OAuth login is enabled. `docker-compose.yml`
in this repo is dev-only (just Postgres) — for a full stack, either run these two images
alongside a managed Postgres instance on whatever platform you choose (Render, Railway, Fly,
ECS, etc.), or write your own compose/k8s manifest referencing them.

## Scripts

Run from the repo root unless noted:

| Command | Description |
| --- | --- |
| `npm run dev` | Run web + api in watch mode via Turborepo |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run check-types` | Typecheck all apps |
| `npm test` | Run the API test suite (Vitest + Supertest) — requires Docker Postgres running and migrated |
| `npm run format` | Format the repo with Prettier |

Inside `apps/api`, additional Prisma helpers:

| Command | Description |
| --- | --- |
| `npm run prisma:generate` | Regenerate the Prisma client after a schema change |
| `npm run prisma:migrate` | Create and apply a new migration in dev |
| `npm run prisma:deploy` | Apply pending migrations without prompting (used in CI/production) |

## Running tests

Tests run against your local dev Postgres (not an isolated test database), so Docker must be up
and migrations applied first:

```bash
docker compose up -d
cd apps/api && npx prisma migrate dev
cd ../.. && npm test
```

## Project structure

```
apps/
  api/                Express API
    src/
      modules/         one folder per domain: auth, workspaces, projects, tasks, github, deployments, notifications, metrics, ...
      middleware/       auth, RBAC, validation, error handling, rate limiting
      routes/           route aggregator mounted at /api/v1
      sockets/          Socket.IO server setup (auth handshake, per-user rooms)
      tests/            Vitest + Supertest suites
    prisma/
      schema.prisma     full data model
      migrations/
    Dockerfile          multi-stage production image (build from repo root)
  web/                Next.js dashboard
    app/               App Router pages (auth, dashboard, projects, project metrics)
    components/        Kanban board, GitHub panel, deployments panel, notification bell, metrics tiles/chart
    lib/                API client, auth context, socket client, notifications context
    Dockerfile          multi-stage production image, Next standalone output
packages/
  shared/               Zod schemas + TS types shared by both apps (compiled to dist/ for production builds)
```

## Troubleshooting

- **Docker Desktop won't start on Windows / WSL2 errors**: make sure virtualization is enabled
  in your BIOS/UEFI, and that Windows features "Virtual Machine Platform" and "Windows
  Subsystem for Linux" are both enabled (`Turn Windows features on or off`).
- **Port 5432 or 3000/4000 already in use**: another process (or a locally installed Postgres)
  is bound to that port. Stop it, or remap the port in `docker-compose.yml` / the app's `PORT`
  env var.
- **`prisma migrate dev` fails to connect**: confirm `docker compose ps` shows the container as
  `Up`, and that `DATABASE_URL` in `apps/api/.env` matches the credentials in
  `docker-compose.yml`.
- **Cloned into `/mnt/c/...` under WSL2 and file watching feels slow**: clone into the Linux
  filesystem instead (e.g. `~/devtrack`), not the Windows-mounted drive — see Option A, step 4.
