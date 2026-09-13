import { z } from "zod";

/**
 * Central, validated access to environment variables.
 *
 * Golden rule: secrets live only in env, never in code. Import `env` from here
 * instead of touching `process.env` directly so a missing/typo'd variable fails
 * fast at boot with a readable message.
 *
 * Only variables needed by the current phase are validated. Add new ones here as
 * phases land (Google, Anthropic, R2, payment providers, ...).
 */
export const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url().optional(),

  // Phase 2b — Google Calendar (OAuth2, outbound sync). All optional: the
  // integration is feature-flagged on CLIENT_ID + CLIENT_SECRET being present.
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),

  // Phase 4/5 — AI (task generation + homework review). Provider is pluggable:
  // AI_PROVIDER picks which adapter runs; the feature is enabled only when that
  // provider's API key is present. Default is Gemini (free tier friendly).
  AI_PROVIDER: z.enum(["gemini", "claude", "openai"]).default("gemini"),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-opus-5"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),

  // Phase 5 — Cloudflare R2 (S3-compatible). Feature-flagged on all four core
  // vars being present; file uploads fall back to text-only without them.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),

  // Phase 2c / 8 — reminders (BullMQ worker) + email (Resend). Email is
  // feature-flagged on RESEND_API_KEY; without it, emails are logged.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z
    .string()
    .min(1)
    .default("Tutoring Platform <onboarding@resend.dev>"),
  // How often the worker scans for due reminders.
  REMINDERS_SCAN_EVERY_MINUTES: z.coerce.number().int().positive().default(10),

  // Whiteboard multiplayer sync — a standalone WebSocket process
  // (`pnpm run whiteboard-sync`), separate from `next dev`/`next start` (see
  // src/jobs/whiteboard-sync-server.ts for why). Ticket HMAC secret; falls
  // back to AUTH_SECRET locally so a fresh checkout works without one more var.
  WHITEBOARD_SYNC_SECRET: z.string().min(1).optional(),
  WHITEBOARD_SYNC_PORT: z.coerce.number().int().positive().default(8788),
});

export const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Base ws(s):// URL of the whiteboard sync process (see WHITEBOARD_SYNC_PORT).
  NEXT_PUBLIC_WHITEBOARD_SYNC_URL: z
    .string()
    .url()
    .default("ws://localhost:8788"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
export type Env = ServerEnv & ClientEnv;

/** Parse against a schema, throwing a single readable error listing every issue. */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: unknown,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Build the typed env object.
 *
 * Server vars are only validated on the server: if a Client Component imports
 * `env`, `process.env` is not populated there, so validating the server schema
 * would throw a false "invalid environment" error in the browser bundle.
 */
export function buildEnv(options?: {
  serverSource?: unknown;
  clientSource?: unknown;
  isServer?: boolean;
}): Env {
  const isServer = options?.isServer ?? typeof window === "undefined";
  const serverSource = options?.serverSource ?? process.env;
  // Next.js only inlines statically referenced NEXT_PUBLIC_* keys, so list them.
  const clientSource = options?.clientSource ?? {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_WHITEBOARD_SYNC_URL:
      process.env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL,
  };

  return {
    ...(isServer ? parseEnv(serverSchema, serverSource) : ({} as ServerEnv)),
    ...parseEnv(clientSchema, clientSource),
  };
}

export const env: Env = buildEnv();
