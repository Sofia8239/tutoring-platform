import { PaymentStatus } from "@/generated/prisma/enums";

import type { BadgeTone } from "@/components/ui/badge";

/** Ukrainian labels + badge tones for payment statuses. Shared server/client. */

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: "Очікує оплати",
  [PaymentStatus.PAID]: "Оплачено",
  [PaymentStatus.OVERDUE]: "Прострочено",
  [PaymentStatus.FAILED]: "Не вдалося",
  [PaymentStatus.REFUNDED]: "Повернено",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, BadgeTone> = {
  [PaymentStatus.PENDING]: "attention",
  [PaymentStatus.PAID]: "success",
  [PaymentStatus.OVERDUE]: "danger",
  [PaymentStatus.FAILED]: "danger",
  [PaymentStatus.REFUNDED]: "neutral",
};
