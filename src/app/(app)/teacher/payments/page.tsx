import type { Metadata } from "next";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatMoney } from "@/lib/money";
import {
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
} from "@/lib/payment-display";
import { listTenantStudents } from "@/server/users/users";
import { listPaymentsForTeacher } from "@/server/payments/payments";
import { isPaymentsConfigured } from "@/server/payments/provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { UserRole } from "@/generated/prisma/enums";

import { RequestPaymentForm } from "./request-payment-form";

export const metadata: Metadata = { title: "Платежі" };

export default async function TeacherPaymentsPage() {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const [payments, students, configured] = await Promise.all([
    listPaymentsForTeacher(teacherId),
    listTenantStudents(teacherId),
    Promise.resolve(isPaymentsConfigured()),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Платежі" />

      {!configured ? (
        <Card className="border-attention/40 bg-attention-soft">
          <p className="text-attention-strong text-sm">
            Онлайн-оплату не налаштовано на сервері (LiqPay або Monobank). Учні
            поки не зможуть оплатити запит онлайн.
          </p>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <CardTitle>Запросити оплату</CardTitle>
        {students.length === 0 ? (
          <p className="text-muted text-sm">
            Спершу запросіть учня, щоб виставити йому оплату.
          </p>
        ) : (
          <RequestPaymentForm students={students} />
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>Історія</CardTitle>
        {payments.length === 0 ? (
          <EmptyState
            icon={<Icon name="card" className="size-5" />}
            title="Ще немає жодного платежу"
            description="Запити на оплату зʼявляться тут разом зі статусом."
          />
        ) : (
          <ul className="divide-line divide-y">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="flex flex-col">
                  <span className="font-medium">
                    {p.studentName ?? p.studentEmail}
                  </span>
                  <span className="text-muted text-xs">
                    {p.description ?? p.lessonSubject ?? "Оплата"} ·{" "}
                    {p.createdAt.toLocaleDateString("uk-UA")}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatMoney(p.amount, p.currency)}
                  </span>
                  <Badge tone={PAYMENT_STATUS_TONE[p.status]}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
