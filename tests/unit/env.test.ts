import { describe, expect, it } from "vitest";

import { buildEnv, parseEnv, serverSchema } from "@/lib/env";

const validServer = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db?schema=public",
  AUTH_SECRET: "test-secret",
};

describe("serverSchema", () => {
  it("applies defaults for optional vars", () => {
    const parsed = parseEnv(serverSchema, validServer);
    expect(parsed.APP_URL).toBe("http://localhost:3000");
    expect(parsed.REDIS_URL).toBe("redis://localhost:6379");
    expect(parsed.AUTH_URL).toBeUndefined();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() =>
      parseEnv(serverSchema, { ...validServer, DATABASE_URL: undefined }),
    ).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-URL DATABASE_URL", () => {
    expect(() =>
      parseEnv(serverSchema, { ...validServer, DATABASE_URL: "not-a-url" }),
    ).toThrow(/Invalid environment variables/);
  });

  it("rejects an empty AUTH_SECRET", () => {
    expect(() =>
      parseEnv(serverSchema, { ...validServer, AUTH_SECRET: "" }),
    ).toThrow(/AUTH_SECRET/);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() =>
      parseEnv(serverSchema, { ...validServer, NODE_ENV: "staging" }),
    ).toThrow();
  });
});

describe("buildEnv", () => {
  it("merges validated server + client env on the server", () => {
    const merged = buildEnv({
      isServer: true,
      serverSource: validServer,
      clientSource: { NEXT_PUBLIC_APP_URL: "https://app.example.com" },
    });
    expect(merged.DATABASE_URL).toContain("postgresql://");
    expect(merged.NEXT_PUBLIC_APP_URL).toBe("https://app.example.com");
  });

  it("skips server validation in the browser bundle", () => {
    expect(() =>
      buildEnv({ isServer: false, serverSource: {}, clientSource: {} }),
    ).not.toThrow();
  });
});
