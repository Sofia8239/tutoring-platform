import { describe, expect, it } from "vitest";

import {
  backoffDelayMs,
  isDailyQuotaExhausted,
  isRetryableHttpStatus,
} from "@/lib/retry-backoff";

describe("isRetryableHttpStatus", () => {
  it("treats request-timeout, rate-limit and 5xx as retryable", () => {
    expect(isRetryableHttpStatus(408)).toBe(true);
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);
  });

  it("treats client errors (bad request, auth) as not retryable", () => {
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(403)).toBe(false);
    expect(isRetryableHttpStatus(404)).toBe(false);
  });
});

describe("isDailyQuotaExhausted", () => {
  it("recognizes a daily free-tier quota error and doesn't retry it", () => {
    const message =
      '{"error":{"code":429,"message":"Quota exceeded...","status":"RESOURCE_EXHAUSTED","details":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}}';
    expect(isDailyQuotaExhausted(429, message)).toBe(true);
  });

  it("does not flag a per-minute rate limit as a daily quota exhaustion", () => {
    const message =
      '{"error":{"code":429,"message":"Quota exceeded...","status":"RESOURCE_EXHAUSTED","details":[{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}}';
    expect(isDailyQuotaExhausted(429, message)).toBe(false);
  });

  it("does not flag a non-429 status even if the message mentions PerDay", () => {
    expect(isDailyQuotaExhausted(503, "PerDay quota talk")).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("doubles each attempt", () => {
    expect(backoffDelayMs(1)).toBe(500);
    expect(backoffDelayMs(2)).toBe(1000);
    expect(backoffDelayMs(3)).toBe(2000);
  });

  it("caps at the given ceiling", () => {
    expect(backoffDelayMs(10, 4000)).toBe(4000);
  });
});
