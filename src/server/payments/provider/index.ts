import "server-only";

import { env } from "@/lib/env";

import { resolvePaymentProviderChoice } from "@/server/payments/provider/choice";
import { createLiqpayProvider } from "@/server/payments/provider/liqpay";
import { createMonobankProvider } from "@/server/payments/provider/monobank";
import type { PaymentProvider } from "@/server/payments/provider/types";

export {
  PaymentError,
  PaymentNotConfiguredError,
} from "@/server/payments/provider/types";
export type {
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhookEvent,
} from "@/server/payments/provider/types";
export { resolvePaymentProviderChoice } from "@/server/payments/provider/choice";

/**
 * The active payment provider, or `null` when none is configured.
 * `PAYMENT_PROVIDER` env: unset (default, payments off) | "liqpay" | "monobank".
 */
export function getPaymentProvider(): PaymentProvider | null {
  const choice = resolvePaymentProviderChoice(env);
  if (!choice) return null;

  switch (choice.provider) {
    case "liqpay":
      return createLiqpayProvider(choice);
    case "monobank":
      return createMonobankProvider(choice);
  }
}

export function isPaymentsConfigured(): boolean {
  return getPaymentProvider() !== null;
}
