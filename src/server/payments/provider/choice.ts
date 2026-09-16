/**
 * Pure provider-selection logic — no SDK/HTTP, no `server-only` — so it unit
 * tests. `getPaymentProvider()` in `./index.ts` calls this and builds the
 * matching adapter. Mirrors `src/server/ai/provider/choice.ts`.
 */

export type PaymentProviderName = "liqpay" | "monobank";

export type PaymentEnv = {
  PAYMENT_PROVIDER?: PaymentProviderName;
  LIQPAY_PUBLIC_KEY?: string;
  LIQPAY_PRIVATE_KEY?: string;
  MONOBANK_ACQUIRING_TOKEN?: string;
};

export type LiqpayChoice = {
  provider: "liqpay";
  publicKey: string;
  privateKey: string;
};
export type MonobankChoice = { provider: "monobank"; token: string };
export type PaymentProviderChoice = LiqpayChoice | MonobankChoice | null;

/**
 * The active provider + its credentials, or `null` when no provider is
 * chosen or its keys are missing. Unlike AI, there is no default — payments
 * stay off until explicitly configured (golden rule: real money).
 */
export function resolvePaymentProviderChoice(
  env: PaymentEnv,
): PaymentProviderChoice {
  if (env.PAYMENT_PROVIDER === "liqpay") {
    if (!env.LIQPAY_PUBLIC_KEY || !env.LIQPAY_PRIVATE_KEY) return null;
    return {
      provider: "liqpay",
      publicKey: env.LIQPAY_PUBLIC_KEY,
      privateKey: env.LIQPAY_PRIVATE_KEY,
    };
  }
  if (env.PAYMENT_PROVIDER === "monobank") {
    if (!env.MONOBANK_ACQUIRING_TOKEN) return null;
    return { provider: "monobank", token: env.MONOBANK_ACQUIRING_TOKEN };
  }
  return null;
}
