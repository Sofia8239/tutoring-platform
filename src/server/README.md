# `src/server` — business logic layer

Framework-agnostic domain services live here. Route Handlers and Server Actions
in `src/app` stay thin: they parse input, call a service in this folder, and
shape the response.

Rules:

- No `next/*` imports. No `Request`/`Response` handling. Pure functions +
  Prisma + other clients from `src/lib`.
- Every query is scoped by owner (`tenantId` / `teacherId`) — never return
  another tenant's data (see golden rule 7).
- Money is integer minor units (kopiykas). Currency is a separate field.
- This is the code we lift into a standalone service when the app outgrows
  Next.js API routes, so keep the boundary clean.

Populated from Phase 1 onward (`lessons/`, `payments/`, `stats/`, `ai/`, ...).
