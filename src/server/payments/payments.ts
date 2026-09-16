import "server-only";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  getPaymentProvider,
  PaymentNotConfiguredError,
  type CreateCheckoutResult,
} from "@/server/payments/provider";
import {
  LessonStatus,
  PaymentProviderKind,
  PaymentStatus,
  UserRole,
} from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Payment requests: a teacher asks a student to pay (for a lesson, or a
 * free-standing amount — the same simple model the Phase 8 payment reminders
 * already assume: one `Payment` row per thing paid for, no forced Invoice).
 * Every query scoped by `teacherId` (golden rule 7).
 */

export class PaymentRequestError extends Error {}

const PROVIDER_KIND: Record<"liqpay" | "monobank", PaymentProviderKind> = {
  liqpay: PaymentProviderKind.LIQPAY,
  monobank: PaymentProviderKind.MONOBANK,
};

export type PaymentListItem = {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: PaymentProviderKind | null;
  description: string | null;
  lessonId: string | null;
  lessonSubject: string | null;
  studentName: string | null;
  studentEmail: string | null;
  createdAt: Date;
  paidAt: Date | null;
};

const LIST_SELECT = {
  id: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  description: true,
  lessonId: true,
  createdAt: true,
  paidAt: true,
  lesson: { select: { subject: true } },
  student: { select: { name: true, email: true } },
} satisfies Prisma.PaymentSelect;

type ListRow = Prisma.PaymentGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(row: ListRow): PaymentListItem {
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    description: row.description,
    lessonId: row.lessonId,
    lessonSubject: row.lesson?.subject ?? null,
    studentName: row.student.name,
    studentEmail: row.student.email,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
  };
}

export async function listPaymentsForTeacher(
  teacherId: string,
): Promise<PaymentListItem[]> {
  const rows = await prisma.payment.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
  });
  return rows.map(toListItem);
}

export async function listPaymentsForStudent(
  studentId: string,
): Promise<PaymentListItem[]> {
  const rows = await prisma.payment.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: LIST_SELECT,
  });
  return rows.map(toListItem);
}

/** Request payment for a specific priced lesson. */
export async function createLessonPaymentRequest(
  teacherId: string,
  lessonId: string,
): Promise<{ paymentId: string }> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: {
      id: true,
      studentId: true,
      subject: true,
      price: true,
      currency: true,
      status: true,
    },
  });
  if (!lesson) throw new PaymentRequestError("Урок не знайдено.");
  if (lesson.price <= 0) {
    throw new PaymentRequestError("У цього уроку не вказано ціну.");
  }
  if (lesson.status === LessonStatus.CANCELLED) {
    throw new PaymentRequestError("Урок скасовано.");
  }

  const existing = await prisma.payment.findFirst({
    where: {
      lessonId,
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PAID] },
    },
    select: { id: true },
  });
  if (existing) {
    throw new PaymentRequestError(
      "Для цього уроку вже є запит на оплату або оплата отримана.",
    );
  }

  const payment = await prisma.payment.create({
    data: {
      teacherId,
      studentId: lesson.studentId,
      lessonId: lesson.id,
      amount: lesson.price,
      currency: lesson.currency,
      status: PaymentStatus.PENDING,
      description: `Урок: ${lesson.subject}`,
    },
    select: { id: true },
  });
  return { paymentId: payment.id };
}

/** Request an arbitrary amount from a student — a top-up, not tied to one lesson. */
export async function createManualPaymentRequest(
  teacherId: string,
  input: {
    studentId: string;
    amount: number;
    currency?: string;
    description?: string;
  },
): Promise<{ paymentId: string }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new PaymentRequestError("Некоректна сума.");
  }

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, tenantId: teacherId, role: UserRole.STUDENT },
    select: { id: true },
  });
  if (!student) {
    throw new PaymentRequestError("Такого учня немає серед ваших учнів.");
  }

  const payment = await prisma.payment.create({
    data: {
      teacherId,
      studentId: student.id,
      amount: input.amount,
      currency: input.currency ?? "UAH",
      status: PaymentStatus.PENDING,
      description: input.description?.trim() || null,
    },
    select: { id: true },
  });
  return { paymentId: payment.id };
}

/**
 * Build (or rebuild) the checkout for a pending payment. Safe to call again
 * for the same payment — LiqPay's form is stateless and Monobank's
 * invoice/create just issues a fresh invoice, overwriting the stale one.
 */
export async function getCheckoutForPayment(
  requesterId: string,
  paymentId: string,
): Promise<CreateCheckoutResult> {
  const provider = getPaymentProvider();
  if (!provider) {
    throw new PaymentNotConfiguredError(
      "Оплату онлайн не налаштовано. Зверніться до викладача.",
    );
  }

  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      OR: [{ studentId: requesterId }, { teacherId: requesterId }],
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      description: true,
      status: true,
    },
  });
  if (!payment) throw new PaymentRequestError("Платіж не знайдено.");
  if (payment.status !== PaymentStatus.PENDING) {
    throw new PaymentRequestError("Цей платіж вже оброблено.");
  }

  const resultUrl = `${env.APP_URL}/student/payments/${payment.id}`;
  const result = await provider.createCheckout({
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    description: payment.description ?? "Оплата занять",
    resultUrl,
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      provider: PROVIDER_KIND[provider.name],
      ...(result.providerTransactionId
        ? { providerTransactionId: result.providerTransactionId }
        : {}),
    },
  });

  return result;
}
