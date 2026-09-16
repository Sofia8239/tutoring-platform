import "server-only";

import { env } from "@/lib/env";
import {
  mapMonobankStatus,
  MONOBANK_CCY_NUMERIC,
  verifyMonobankSignature,
} from "@/lib/monobank-signature";
import type { MonobankChoice } from "@/server/payments/provider/choice";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhookEvent,
  PaymentProvider,
} from "@/server/payments/provider/types";

/**
 * Monobank Acquiring integration (api.monobank.ua/docs/acquiring.html):
 *   - POST /api/merchant/invoice/create — `amount` in the currency's MINOR
 *     unit (kopiykas — matches how we store money everywhere, no conversion
 *     needed here unlike LiqPay), `ccy` the ISO 4217 *numeric* code.
 *     Response: `{ invoiceId, pageUrl }` — `pageUrl` is a ready redirect URL,
 *     no client-side form needed (unlike LiqPay).
 *   - Webhook signature verification lives in `src/lib/monobank-signature.ts`
 *     (pure); this file only fetches + caches the verification key from
 *     GET /api/merchant/pubkey (base64(PEM(SPKI)) — the bank rotates it
 *     rarely, so a plain module-level cache is enough for this app's scale).
 */

const API_BASE = "https://api.monobank.ua";

type InvoiceCreateResponse = { invoiceId: string; pageUrl: string };

type InvoiceWebhookPayload = {
  invoiceId?: string;
  status?: string;
  reference?: string;
  modifiedDate?: string;
};

let cachedPublicKeyPem: string | null = null;

async function fetchPublicKeyPem(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/merchant/pubkey`, {
    headers: { "X-Token": token },
  });
  if (!res.ok) {
    throw new Error(`Monobank pubkey fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as { key: string };
  return Buffer.from(body.key, "base64").toString("utf8");
}

function webhookUrl(): string {
  return `${env.PAYMENTS_WEBHOOK_BASE_URL ?? env.APP_URL}/api/payments/monobank/webhook`;
}

export function createMonobankProvider(
  choice: MonobankChoice,
): PaymentProvider {
  const { token } = choice;

  return {
    name: "monobank",

    async createCheckout(
      input: CreateCheckoutInput,
    ): Promise<CreateCheckoutResult> {
      const ccy = MONOBANK_CCY_NUMERIC[input.currency];
      if (!ccy) {
        throw new Error(`Unsupported currency for Monobank: ${input.currency}`);
      }

      const res = await fetch(`${API_BASE}/api/merchant/invoice/create`, {
        method: "POST",
        headers: {
          "X-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amount, // already minor units — no conversion
          ccy,
          merchantPaymInfo: {
            reference: input.paymentId,
            destination: input.description,
          },
          redirectUrl: input.resultUrl,
          webHookUrl: webhookUrl(),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Monobank invoice/create failed: ${res.status} ${body.slice(0, 300)}`,
        );
      }
      const body = (await res.json()) as InvoiceCreateResponse;

      return {
        kind: "redirect",
        url: body.pageUrl,
        providerTransactionId: body.invoiceId,
      };
    },

    async parseWebhook({
      rawBody,
      headers,
    }): Promise<ParsedWebhookEvent | null> {
      const signatureB64 = headers.get("x-sign");
      if (!signatureB64) return null;

      if (!cachedPublicKeyPem) {
        cachedPublicKeyPem = await fetchPublicKeyPem(token).catch(() => null);
      }
      if (!cachedPublicKeyPem) return null;

      let valid = verifyMonobankSignature(
        rawBody,
        signatureB64,
        cachedPublicKeyPem,
      );
      // The bank can rotate the key; one forced refresh + retry before
      // treating this as a genuinely invalid signature.
      if (!valid) {
        cachedPublicKeyPem = await fetchPublicKeyPem(token).catch(() => null);
        if (!cachedPublicKeyPem) return null;
        valid = verifyMonobankSignature(
          rawBody,
          signatureB64,
          cachedPublicKeyPem,
        );
      }
      if (!valid) return null;

      let payload: InvoiceWebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return null;
      }
      if (!payload.invoiceId || !payload.status || !payload.reference) {
        return null;
      }

      return {
        providerEventId: `${payload.invoiceId}:${payload.status}:${payload.modifiedDate ?? ""}`,
        paymentId: payload.reference,
        providerTransactionId: payload.invoiceId,
        outcome: mapMonobankStatus(payload.status),
        raw: payload,
      };
    },
  };
}
