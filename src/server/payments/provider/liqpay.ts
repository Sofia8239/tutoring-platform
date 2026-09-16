import "server-only";

import { env } from "@/lib/env";
import { toMajorString } from "@/lib/money";
import {
  liqpayEncodeParams,
  liqpaySignData,
  liqpayVerifySignature,
  mapLiqpayStatus,
} from "@/lib/liqpay-signature";
import type { LiqpayChoice } from "@/server/payments/provider/choice";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  ParsedWebhookEvent,
  PaymentProvider,
} from "@/server/payments/provider/types";

/**
 * LiqPay integration, verified against the official SDK source
 * (github.com/liqpay/sdk-php, `LiqPay.php`) rather than guessed — see
 * `src/lib/liqpay-signature.ts` for the signature/encoding details.
 *   - Checkout has no server-to-server call: the browser POSTs `data` +
 *     `signature` as a form to https://www.liqpay.ua/api/3/checkout and
 *     LiqPay redirects from there — `cnb_form`. So `createCheckout` only
 *     builds that form; there's nothing to await over the network.
 *   - `amount` is in the currency's MAJOR unit (e.g. "150.00" UAH), unlike
 *     Monobank's kopiykas — confirmed against LiqPay's own documented
 *     examples ("amount":"3" for 3 UAH). We store money in minor units
 *     everywhere else (golden rule), so this is the one conversion point.
 */

const CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";

type LiqpayCallbackData = {
  order_id?: string;
  transaction_id?: number | string;
  payment_id?: number | string;
  status?: string;
};

function webhookUrl(): string {
  return `${env.PAYMENTS_WEBHOOK_BASE_URL ?? env.APP_URL}/api/payments/liqpay/webhook`;
}

export function createLiqpayProvider(choice: LiqpayChoice): PaymentProvider {
  const { publicKey, privateKey } = choice;

  return {
    name: "liqpay",

    async createCheckout(
      input: CreateCheckoutInput,
    ): Promise<CreateCheckoutResult> {
      const params: Record<string, unknown> = {
        public_key: publicKey,
        version: 3,
        action: "pay",
        amount: toMajorString(input.amount),
        currency: input.currency,
        description: input.description,
        order_id: input.paymentId,
        result_url: input.resultUrl,
        server_url: webhookUrl(),
      };
      const data = liqpayEncodeParams(params);
      const signature = liqpaySignData(data, privateKey);

      return {
        kind: "form",
        url: CHECKOUT_URL,
        fields: { data, signature },
        // LiqPay hands out a transaction id only via the callback, never at
        // checkout-creation time — nothing to record yet.
        providerTransactionId: null,
      };
    },

    async parseWebhook({ rawBody }): Promise<ParsedWebhookEvent | null> {
      const form = new URLSearchParams(rawBody);
      const data = form.get("data");
      const signature = form.get("signature");
      if (!data || !signature) return null;
      if (!liqpayVerifySignature(data, signature, privateKey)) return null;

      let decoded: LiqpayCallbackData;
      try {
        decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
      } catch {
        return null;
      }
      if (!decoded.order_id || !decoded.status) return null;

      const transactionId = String(
        decoded.transaction_id ?? decoded.payment_id ?? decoded.order_id,
      );

      return {
        // LiqPay redelivers the same payment_id/status pair on retry — that
        // pair is what makes redelivery a no-op via PaymentWebhookEvent's
        // dedupe key, not a synthetic nonce.
        providerEventId: `${transactionId}:${decoded.status}`,
        paymentId: decoded.order_id,
        providerTransactionId: transactionId,
        outcome: mapLiqpayStatus(decoded.status),
        raw: decoded,
      };
    },
  };
}
