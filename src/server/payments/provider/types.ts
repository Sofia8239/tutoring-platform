/**
 * Provider-neutral payment contract. Business logic (creating a payment
 * request, handling a webhook) depends only on this — swapping LiqPay /
 * Monobank is an env change, not a code change. Mirrors the shape of
 * `src/server/ai/provider/types.ts`.
 */

export class PaymentError extends Error {}
export class PaymentNotConfiguredError extends PaymentError {}

export type CreateCheckoutInput = {
  /** Our own `Payment.id` — the one stable identifier both providers echo
   *  back (as `order_id` for LiqPay, `reference` for Monobank), so a webhook
   *  can always be matched to a row even before any provider-side id exists. */
  paymentId: string;
  /** Minor units (kopiykas). */
  amount: number;
  currency: string;
  description: string;
  /** Where the payer lands back in our app after paying. */
  resultUrl: string;
};

/**
 * LiqPay's checkout is a browser form POST (no server-to-server call, no URL
 * until the browser submits it) while Monobank's is a plain redirect URL
 * handed back synchronously — a discriminated union lets each route handler
 * render the right thing without the domain layer knowing which provider is
 * active.
 */
export type CreateCheckoutResult =
  | { kind: "redirect"; url: string; providerTransactionId: string | null }
  | {
      kind: "form";
      url: string;
      fields: Record<string, string>;
      providerTransactionId: string | null;
    };

export type WebhookOutcome = "paid" | "failed" | "refunded" | "ignored";

export type ParsedWebhookEvent = {
  /** Dedupe key for `PaymentWebhookEvent` — unique per (provider, this id). */
  providerEventId: string;
  /** Our `Payment.id`, recovered from the order/reference field. */
  paymentId: string;
  providerTransactionId: string;
  outcome: WebhookOutcome;
  /** The verified, decoded payload — stored as `providerRawJson`. */
  raw: unknown;
};

export interface PaymentProvider {
  readonly name: "liqpay" | "monobank";
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /**
   * Verify the webhook's signature and parse it. Returns `null` for a bad
   * signature (the caller should respond 400 and NOT process the payload) —
   * this is the one place a forged "payment succeeded" call gets rejected.
   */
  parseWebhook(input: {
    rawBody: string;
    headers: Headers;
  }): Promise<ParsedWebhookEvent | null>;
}
