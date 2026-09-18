/**
 * Pure retry-backoff logic for transient upstream API failures (rate limits,
 * temporary overload) — distinct from retrying a malformed-but-successful
 * response, which doesn't need a delay.
 */

const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUS.has(status);
}

/**
 * A 429 can mean "you're going a bit fast, back off a few seconds" (worth
 * retrying) or "you've used today's free-tier allowance" (retrying is
 * pointless — it won't reset for hours). Google's quota error embeds which
 * one it is in the quota id, e.g. "...PerDayPerProjectPerModel-FreeTier".
 */
export function isDailyQuotaExhausted(status: number, message: string): boolean {
  return status === 429 && /PerDay/i.test(message);
}

/** Exponential backoff with a cap: 500ms, 1000ms, 2000ms, ... up to `capMs`. */
export function backoffDelayMs(attempt: number, capMs = 4000): number {
  return Math.min(500 * 2 ** (attempt - 1), capMs);
}
