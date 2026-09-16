import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/server/payments/provider";
import { processPaymentWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * LiqPay's `server_url` callback. Public — no session, no tenant check:
 * LiqPay's own servers call this. The only gate is the request's signature,
 * verified inside `processPaymentWebhook` against `LIQPAY_PRIVATE_KEY`.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== "liqpay") {
    return new NextResponse("Not configured", { status: 404 });
  }

  const rawBody = await request.text();
  const { status } = await processPaymentWebhook(
    provider,
    rawBody,
    request.headers,
  );
  return new NextResponse(null, { status });
}
