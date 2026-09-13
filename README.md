# Tutoring Platform

SaaS workspace for online tutoring. Single-tenant today, multi-tenant-ready by
design (every domain row is scoped to a `tenantId` / `teacherId`).

## Stack

| Area       | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4       |
| Database   | PostgreSQL + Prisma 7 (`prisma-client` generator, pg adapter) |
| Auth       | Auth.js (NextAuth v5), JWT sessions, role-based              |
| Files      | Cloudflare R2 (S3 API) — Phase 5                             |
| Queues     | BullMQ + Redis — Phase 2                                     |
| AI         | Anthropic Claude API — Phase 4/5                             |
| Payments   | LiqPay + Monobank behind one `PaymentProvider` — Phase 7     |
| Email      | Resend — Phase 2                                             |
| Tests      | Vitest                                                        |

## Prerequisites

- Node.js 20.19+ / 22.12+ / 24+ (Turbopack + Prisma 7 requirement)
- pnpm (`corepack enable pnpm`)
- Docker (for local Postgres + Redis) — or your own Postgres 17 / Redis 7

## Getting started

```bash
pnpm install                 # also runs `prisma generate` (postinstall)
cp .env.example .env          # then set AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

docker compose up -d          # Postgres :5432, Redis :6379
pnpm db:migrate               # create/apply migrations (Phase 1 adds the schema)

pnpm dev                      # http://localhost:3000
```

Sanity checks:

- `curl localhost:3000/api/health` → `{"status":"ok","db":"up",...}`
- `curl localhost:3000/api/auth/providers` → `{}` (no providers until Phase 1)

## Scripts

| Script               | What it does                              |
| -------------------- | ---------------------------------------- |
| `pnpm dev`           | Dev server (Turbopack)                   |
| `pnpm build`         | Production build                         |
| `pnpm start`         | Serve the production build               |
| `pnpm typecheck`     | `tsc --noEmit`                           |
| `pnpm lint`          | ESLint                                   |
| `pnpm format`        | Prettier write                          |
| `pnpm test`          | Vitest (run once)                        |
| `pnpm test:watch`    | Vitest watch                            |
| `pnpm db:migrate`    | `prisma migrate dev`                     |
| `pnpm db:studio`     | Prisma Studio                           |
| `pnpm db:reset`      | Drop + re-apply migrations + seed        |
| `pnpm db:seed`       | Run `prisma/seed.ts` (added in Phase 1)  |

## Project structure

```
prisma/
  schema.prisma        # models (Phase 0: auth + User only)
prisma.config.ts       # Prisma 7 config (DB URL for the CLI lives here)
src/
  app/                 # App Router routes
    api/health/        # liveness + DB probe
    api/auth/[...nextauth]/
  lib/                 # env (zod-validated), prisma singleton, auth config
  server/              # framework-agnostic business logic (Phase 1+)
  components/          # UI (Phase 1+)
  jobs/                # BullMQ workers/queues (Phase 2+)
  types/               # shared types + module augmentation
  generated/prisma/    # generated client (git-ignored)
tests/                 # Vitest (unit / integration)
```

## Conventions (see the build prompt's "golden rules")

- Money is stored as **integer minor units** (kopiykas); currency is a separate
  field; never `float`.
- Status fields are enums with explicit timestamps (`completedAt`, `paidAt`,
  `cancelledAt`) so historical stats are reconstructable.
- Payment webhooks are **idempotent** — dedupe on `providerTransactionId`.
- AI responses are **structured JSON validated with Zod**, never free-text
  parsing.
- Secrets only in env. `src/lib/env.ts` validates them at boot.
- Every query is scoped by owner; no endpoint returns another tenant's data.
