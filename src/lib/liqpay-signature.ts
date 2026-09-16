import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Pure LiqPay signature logic, verified against the official SDK source
 * (github.com/liqpay/sdk-php, `LiqPay.php`): `str_to_sign` is
 * `base64_encode(sha1($str, 1))` — a *binary* SHA1 digest, base64-encoded
 * (not hex) — and `encode_params` is plain `base64_encode(json_encode($params))`.
 * No `server-only`: kept import-safe from a `payments/provider` module and
 * from `tests/` alike.
 */

export function liqpaySign(str: string): string {
  return createHash("sha1").update(str, "utf8").digest("base64");
}

export function liqpayEncodeParams(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params), "utf8").toString("base64");
}

/** signature = base64(sha1(private_key + data + private_key)). */
export function liqpaySignData(data: string, privateKey: string): string {
  return liqpaySign(privateKey + data + privateKey);
}

export function liqpayVerifySignature(
  data: string,
  signature: string,
  privateKey: string,
): boolean {
  const expected = liqpaySignData(data, privateKey);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type LiqpayOutcome = "paid" | "failed" | "refunded" | "ignored";

const SUCCESS_STATUSES = new Set(["success", "sandbox"]);
const FAILURE_STATUSES = new Set([
  "failure",
  "error",
  "expired",
  "cancel",
  "captcha_verify_fail",
]);
const REFUND_STATUSES = new Set(["reversed"]);

export function mapLiqpayStatus(status: string): LiqpayOutcome {
  if (SUCCESS_STATUSES.has(status)) return "paid";
  if (FAILURE_STATUSES.has(status)) return "failed";
  if (REFUND_STATUSES.has(status)) return "refunded";
  return "ignored";
}
