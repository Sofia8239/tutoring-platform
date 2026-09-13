// Runs before every test file (Vitest `setupFiles`), ahead of the test module
// graph being imported. Keep tests deterministic and offline by default, and
// provide safe values for env vars that modules validate at import time.
const mutableEnv = process.env as Record<string, string>;

mutableEnv.TZ = "UTC";
mutableEnv.NODE_ENV = "test";
mutableEnv.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/test?schema=public";
mutableEnv.AUTH_SECRET ??= "test-secret-not-used-for-real-signing";
