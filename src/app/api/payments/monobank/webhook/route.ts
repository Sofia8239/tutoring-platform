import { NextResponse } from "next/server";

import { getPaymentProvider } from "@/server/payments/provider";
import { processPaymentWebhook } from "@/server/payments/webhook";

export const dynamic = "force-dynamic";

/**
 * Monobank's `webHookUrl` callback. Public — no session, no tenant check:
 * Monobank's own servers call this. The only gate is the `X-Sign` ECDSA
 * signature, verified inside `processPaymentWebhook` against Monobank's
 * published public key.
 */
export async function POST(request: Request) {
  const provider = getPaymentProvider();
  if (!provider || provider.name !== "monobank") {
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
