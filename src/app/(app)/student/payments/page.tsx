import type { Metadata } from "next";

import { requireRole } from "@/lib/session";
import { formatMoney } from "@/lib/money";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-display";
import { listPaymentsForStudent } from "@/server/payments/payments";
import { isPaymentsConfigured } from "@/server/payments/provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { PaymentStatus, UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Платежі" };

export default async function StudentPaymentsPage() {
  const user = await requireRole(UserRole.STUDENT);

  const [payments, configured] = await Promise.all([
    listPaymentsForStudent(user.id),
    Promise.resolve(isPaymentsConfigured()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Платежі" />

      {payments.length === 0 ? (
        <EmptyState
          icon={<Icon name="card" className="size-5" />}
          title="Поки немає запитів на оплату"
          description="Коли викладач виставить оплату, вона зʼявиться тут."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {payments.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <span className="flex flex-col">
                  <span className="text-sm font-medium">
                    {p.description ?? p.lessonSubject ?? "Оплата"}
                  </span>
                  <span className="text-muted text-xs">
                    {p.createdAt.toLocaleDateString("uk-UA")}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    {formatMoney(p.amount, p.currency)}
                  </span>
                  <Badge tone={PAYMENT_STATUS_TONE[p.status]}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </Badge>
                  {p.status === PaymentStatus.PENDING && configured ? (
                    <a
                      href={`/api/payments/${p.id}/checkout`}
                      className={buttonClass("primary", "sm")}
                    >
                      Оплатити
                    </a>
                  ) : null}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
