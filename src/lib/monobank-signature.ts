import { createVerify } from "node:crypto";

/**
 * Pure Monobank Acquiring webhook-verification logic (api.monobank.ua/docs/acquiring.html):
 * the `X-Sign` header is an ECDSA-SHA256 (NIST P-256) signature, DER-encoded
 * and base64'd, over the raw request body. No `server-only`: kept
 * import-safe from a `payments/provider` module and from `tests/` alike —
 * fetching/caching the actual public key stays in the provider file, which
 * does need `server-only` (it makes an HTTP call).
 */

export function verifyMonobankSignature(
  rawBody: string,
  signatureBase64: string,
  publicKeyPem: string,
): boolean {
  try {
    return createVerify("SHA256")
      .update(rawBody, "utf8")
      .verify(publicKeyPem, signatureBase64, "base64");
  } catch {
    return false;
  }
}

/** ISO 4217 numeric currency codes Monobank's `ccy` field expects. */
export const MONOBANK_CCY_NUMERIC: Record<string, number> = {
  UAH: 980,
  USD: 840,
  EUR: 978,
};

export type MonobankOutcome = "paid" | "failed" | "refunded" | "ignored";

const SUCCESS_STATUSES = new Set(["success"]);
const FAILURE_STATUSES = new Set(["failure", "expired"]);
const REFUND_STATUSES = new Set(["reversed"]);

export function mapMonobankStatus(status: string): MonobankOutcome {
  if (SUCCESS_STATUSES.has(status)) return "paid";
  if (FAILURE_STATUSES.has(status)) return "failed";
  if (REFUND_STATUSES.has(status)) return "refunded";
  return "ignored";
}
