import { NextResponse } from "next/server";

import { requireUser } from "@/lib/session";
import {
  getCheckoutForPayment,
  PaymentRequestError,
} from "@/server/payments/payments";
import { PaymentNotConfiguredError } from "@/server/payments/provider";

export const dynamic = "force-dynamic";

/**
 * Sends the payer to checkout: a redirect for Monobank, or a tiny
 * auto-submitting form for LiqPay (its checkout is POST-only — see
 * `src/server/payments/provider/liqpay.ts`). Either the payer (student) or
 * the teacher who requested the payment may open this link.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const user = await requireUser();
  const { paymentId } = await ctx.params;

  let checkout;
  try {
    checkout = await getCheckoutForPayment(user.id, paymentId);
  } catch (error) {
    if (error instanceof PaymentNotConfiguredError) {
      return new NextResponse(error.message, { status: 503 });
    }
    if (error instanceof PaymentRequestError) {
      return new NextResponse(error.message, { status: 400 });
    }
    throw error;
  }

  if (checkout.kind === "redirect") {
    return NextResponse.redirect(checkout.url);
  }

  const inputs = Object.entries(checkout.fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeAttr(name)}" value="${escapeAttr(value)}">`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="uk">
<head><meta charset="utf-8"><title>Перехід до оплати…</title></head>
<body>
<p>Перехід до оплати…</p>
<form id="checkout" method="POST" action="${escapeAttr(checkout.url)}">
${inputs}
</form>
<script>document.getElementById("checkout").submit();</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
