# Build from the MONOREPO ROOT, not this directory, since npm workspaces need
# the root package.json/lockfile and the @repo/shared workspace package:
#   docker build -f apps/api/Dockerfile -t devtrack-api .
FROM node:20-alpine AS base
# Prisma's query engine needs OpenSSL, which musl-based Alpine doesn't ship by default.
RUN apk add --no-cache openssl
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN npm ci

FROM deps AS build
COPY . .
# Must run before the build: apps/api/src/lib/prisma.ts imports types from the
# generated client, so `tsc` fails without it. Generating here (inside the
# same Alpine container that will run the app) also guarantees the query
# engine binary matches musl/Alpine, rather than shipping a binary built for
# whatever OS ran `docker build`.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npx turbo run build --filter=api

FROM base AS runtime
ENV NODE_ENV=production
# Keeping the full node_modules (rather than an --omit=dev prod-only install)
# is a deliberate size-vs-simplicity tradeoff: the `prisma` CLI is a
# devDependency, and this keeps `docker run <image> npx prisma migrate deploy`
# workable against this same image as a pre-deploy release step, instead of
# needing a second image variant just for migrations.
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/generated ./apps/api/generated
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
