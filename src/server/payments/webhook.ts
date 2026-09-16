import "server-only";

import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { deliverNotification } from "@/server/notifications/notify";
import type {
  ParsedWebhookEvent,
  PaymentProvider,
} from "@/server/payments/provider/types";
import {
  NotificationType,
  PaymentProviderKind,
  PaymentStatus,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Processes one inbound payment webhook: verify -> dedupe -> apply.
 *
 * Idempotency (golden rule 4): every event is recorded once in
 * `PaymentWebhookEvent`, keyed on `(provider, providerEventId)` — a provider
 * that redelivers the same event (all of them do, on any timeout) hits the
 * unique constraint and this becomes a no-op, not a double-credit.
 *
 * Once the signature has verified, this always resolves to `{ status: 200 }`
 * — even if something downstream fails (unknown payment id, a transient DB
 * error) — logged onto the event row instead of surfaced as an HTTP error,
 * so a provider's retry-on-failure behavior can't turn one bad webhook into
 * an infinite retry storm. Only a bad signature gets a non-200 (400), which
 * providers don't retry around.
 */
export async function processPaymentWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
): Promise<{ status: number }> {
  const providerKind = PROVIDER_KIND[provider.name];

  const parsed = await provider.parseWebhook({ rawBody, headers });
  if (!parsed) return { status: 400 };

  const event = await recordEventOnce(providerKind, parsed);
  if (!event.fresh) return { status: 200 }; // already processed (or in flight)

  try {
    await applyOutcome(parsed, providerKind);
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
  } catch (error) {
    await prisma.paymentWebhookEvent
      .update({
        where: { id: event.id },
        data: { error: error instanceof Error ? error.message : String(error) },
      })
      .catch(() => undefined);
  }

  return { status: 200 };
}

const PROVIDER_KIND: Record<"liqpay" | "monobank", PaymentProviderKind> = {
  liqpay: PaymentProviderKind.LIQPAY,
  monobank: PaymentProviderKind.MONOBANK,
};

/** findUnique-then-create, same idempotent-insert shape as `deliverNotification`. */
async function recordEventOnce(
  provider: PaymentProviderKind,
  parsed: ParsedWebhookEvent,
): Promise<{ id: string; fresh: boolean }> {
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider,
        providerEventId: parsed.providerEventId,
      },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, fresh: false };

  try {
    const created = await prisma.paymentWebhookEvent.create({
      data: {
        provider,
        providerEventId: parsed.providerEventId,
        providerTransactionId: parsed.providerTransactionId,
        payloadJson: parsed.raw as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    return { id: created.id, fresh: true };
  } catch {
    // Lost a race on the unique constraint — another delivery beat us to it.
    const raced = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId: parsed.providerEventId,
        },
      },
      select: { id: true },
    });
    return { id: raced.id, fresh: false };
  }
}

async function applyOutcome(
  parsed: ParsedWebhookEvent,
  providerKind: PaymentProviderKind,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { id: parsed.paymentId },
    select: {
      id: true,
      status: true,
      teacherId: true,
      amount: true,
      currency: true,
    },
  });
  if (!payment) {
    throw new Error(`Webhook for unknown payment ${parsed.paymentId}`);
  }
  // Terminal states don't get overwritten by a redelivered/late event.
  if (
    payment.status === PaymentStatus.PAID ||
    payment.status === PaymentStatus.REFUNDED
  ) {
    return;
  }

  const data: Prisma.PaymentUpdateInput = {
    provider: providerKind,
    providerTransactionId: parsed.providerTransactionId,
    providerRawJson: parsed.raw as Prisma.InputJsonValue,
  };
  if (parsed.outcome === "paid") {
    data.status = PaymentStatus.PAID;
    data.paidAt = new Date();
  } else if (parsed.outcome === "failed") {
    data.status = PaymentStatus.FAILED;
    data.failedAt = new Date();
  } else if (parsed.outcome === "refunded") {
    data.status = PaymentStatus.REFUNDED;
    data.refundedAt = new Date();
  }

  await prisma.payment.update({ where: { id: payment.id }, data });

  if (parsed.outcome === "paid") {
    await deliverNotification({
      userId: payment.teacherId,
      teacherId: payment.teacherId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: "Отримано оплату",
      body: `Оплата на суму ${formatMoney(payment.amount, payment.currency)} зарахована.`,
      dedupeKey: `payment-received:${payment.id}`,
    });
  }
}
