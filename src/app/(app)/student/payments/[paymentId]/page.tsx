import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-display";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { PaymentStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Платіж" };

/**
 * Where a payer lands back after checkout (LiqPay/Monobank's `result_url`).
 * The webhook is what actually settles the status — this page just shows
 * whatever it is right now, with a hint if it's still catching up.
 */
export default async function StudentPaymentResultPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { paymentId } = await params;

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, studentId: user.id },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      description: true,
    },
  });
  if (!payment) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Платіж" />

      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>
          {PAYMENT_STATUS_LABEL[payment.status]}
        </Badge>
        <p className="text-2xl font-semibold tracking-tight">
          {formatMoney(payment.amount, payment.currency)}
        </p>
        <p className="text-muted text-sm">{payment.description ?? "Оплата"}</p>
        {payment.status === PaymentStatus.PENDING ? (
          <p className="text-muted max-w-sm text-xs">
            Якщо ви щойно оплатили — статус оновиться протягом хвилини. Оновіть
            сторінку.
          </p>
        ) : null}
        <Link
          href="/student/payments"
          className={buttonClass("secondary", "sm")}
        >
          До всіх платежів
        </Link>
      </Card>
    </div>
  );
}
