import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  AssignmentSourceType,
  ChatSenderType,
  InvoiceStatus,
  LessonStatus,
  NotificationType,
  PaymentProviderKind,
  PaymentStatus,
  SubmissionStatus,
  UserRole,
} from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/password";
import { generateToken, hashToken } from "../src/lib/tokens";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
});

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const DEMO_PASSWORD = "Password123!";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();

/** Remove everything previously seeded for this tenant so the seed is repeatable. */
async function resetTenant(teacherId: string): Promise<void> {
  await prisma.aIReview.deleteMany({ where: { teacherId } });
  await prisma.submission.deleteMany({ where: { teacherId } });
  await prisma.assignment.deleteMany({ where: { teacherId } });
  await prisma.chatMessage.deleteMany({ where: { teacherId } });
  await prisma.whiteboard.deleteMany({ where: { teacherId } });
  await prisma.page.deleteMany({ where: { teacherId } });
  await prisma.calendarEvent.deleteMany({ where: { teacherId } });
  await prisma.paymentReminder.deleteMany({ where: { teacherId } });
  await prisma.payment.deleteMany({ where: { teacherId } });
  await prisma.invoice.deleteMany({ where: { teacherId } });
  await prisma.lesson.deleteMany({ where: { teacherId } });
  await prisma.notification.deleteMany({ where: { teacherId } });
  await prisma.dailyStats.deleteMany({ where: { teacherId } });
  await prisma.dailyErrorStat.deleteMany({ where: { teacherId } });
  await prisma.invitation.deleteMany({ where: { teacherId } });
  await prisma.user.deleteMany({
    where: { tenantId: teacherId, role: UserRole.STUDENT },
  });
}

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // --- Teacher (tenant owner) --------------------------------------------
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@tutoring.local" },
    update: {
      name: "Олена Викладачка",
      passwordHash,
      role: UserRole.TEACHER,
      defaultMeetingUrl: "https://zoom.us/j/1234567890",
    },
    create: {
      email: "teacher@tutoring.local",
      name: "Олена Викладачка",
      role: UserRole.TEACHER,
      passwordHash,
      timezone: "Europe/Kyiv",
      defaultMeetingUrl: "https://zoom.us/j/1234567890",
    },
  });
  await prisma.user.update({
    where: { id: teacher.id },
    data: { tenantId: teacher.id },
  });
  const teacherId = teacher.id;

  await resetTenant(teacherId);

  // --- Students --------------------------------------------------------
  const anna = await prisma.user.create({
    data: {
      email: "anna@tutoring.local",
      name: "Анна Учениця",
      role: UserRole.STUDENT,
      tenantId: teacherId,
      passwordHash,
      emailVerified: new Date(),
    },
  });
  const bohdan = await prisma.user.create({
    data: {
      email: "bohdan@tutoring.local",
      name: "Богдан Учень",
      role: UserRole.STUDENT,
      tenantId: teacherId,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  // --- Pending invitation --------------------------------------------
  const rawToken = generateToken();
  await prisma.invitation.create({
    data: {
      teacherId,
      createdById: teacherId,
      email: "dmytro@tutoring.local",
      role: UserRole.STUDENT,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(now + 7 * DAY),
    },
  });

  // --- Lessons (one of each status) --------------------------------
  const completedLesson = await prisma.lesson.create({
    data: {
      teacherId,
      studentId: anna.id,
      subject: "Математика — квадратні рівняння",
      scheduledStart: new Date(now - 7 * DAY),
      scheduledEnd: new Date(now - 7 * DAY + HOUR),
      status: LessonStatus.COMPLETED,
      completedAt: new Date(now - 7 * DAY + HOUR),
      price: 30000,
      currency: "UAH",
      meetLink: "https://meet.google.com/seed-abc-defg",
    },
  });

  await prisma.lesson.create({
    data: {
      teacherId,
      studentId: anna.id,
      subject: "Математика — теорема Вієта",
      scheduledStart: new Date(now + 2 * DAY),
      scheduledEnd: new Date(now + 2 * DAY + HOUR),
      status: LessonStatus.SCHEDULED,
      price: 30000,
    },
  });

  await prisma.lesson.create({
    data: {
      teacherId,
      studentId: bohdan.id,
      subject: "Фізика — кінематика",
      scheduledStart: new Date(now + 3 * DAY),
      scheduledEnd: new Date(now + 3 * DAY + HOUR),
      status: LessonStatus.SCHEDULED,
      price: 35000,
    },
  });

  await prisma.lesson.create({
    data: {
      teacherId,
      studentId: bohdan.id,
      subject: "Фізика — динаміка",
      scheduledStart: new Date(now - 1 * DAY),
      scheduledEnd: new Date(now - 1 * DAY + HOUR),
      status: LessonStatus.CANCELLED,
      cancelledAt: new Date(now - 2 * DAY),
      cancelledById: teacherId,
      cancellationReason: "Учень захворів",
      price: 35000,
    },
  });

  await prisma.lesson.create({
    data: {
      teacherId,
      studentId: anna.id,
      subject: "Математика — прогресії",
      scheduledStart: new Date(now - 3 * DAY),
      scheduledEnd: new Date(now - 3 * DAY + HOUR),
      status: LessonStatus.NO_SHOW,
      price: 30000,
    },
  });

  // --- Whiteboard + page for the completed lesson --------------
  await prisma.whiteboard.create({
    data: { lessonId: completedLesson.id, teacherId, sceneJson: {} },
  });
  await prisma.page.create({
    data: {
      teacherId,
      lessonId: completedLesson.id,
      ownerId: teacherId,
      title: "Конспект: квадратні рівняння",
      contentJson: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "D = b² − 4ac" }],
          },
        ],
      },
    },
  });

  // --- Assignment + submission + AI review --------------------
  const assignment = await prisma.assignment.create({
    data: {
      teacherId,
      lessonId: completedLesson.id,
      studentId: anna.id,
      title: "Розвʼязати 5 квадратних рівнянь",
      description: "Рівняння 1–5 зі сторінки конспекту. Показати дискримінант.",
      sourceType: AssignmentSourceType.MANUAL,
      dueAt: new Date(now + 3 * DAY),
    },
  });

  const submission = await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      teacherId,
      studentId: anna.id,
      lessonId: completedLesson.id,
      text: "Рівняння 1: x=2, x=3. Рівняння 2: D<0, коренів немає. ...",
      status: SubmissionStatus.REVIEWED,
      submittedAt: new Date(now - 2 * DAY),
    },
  });

  await prisma.aIReview.create({
    data: {
      submissionId: submission.id,
      teacherId,
      model: "claude-sonnet-5",
      score: 82,
      summary:
        "Загалом добре. Основна проблема — знак у формулі коренів і одна арифметична помилка.",
      errorsJson: [
        {
          location: "Рівняння 3, другий крок",
          type: "арифметика",
          explanation: "16 − 24 = −8, а не 8. Дискримінант відʼємний.",
          severity: "major",
        },
        {
          location: "Рівняння 4, формула коренів",
          type: "формула",
          explanation: "Пропущено ± перед коренем із дискримінанта.",
          severity: "minor",
        },
      ],
      promptTokens: 1200,
      outputTokens: 340,
    },
  });

  // --- Invoice + payments -------------------------------------
  const invoice = await prisma.invoice.create({
    data: {
      teacherId,
      studentId: anna.id,
      number: "INV-0001",
      status: InvoiceStatus.PAID,
      totalAmount: 30000,
      currency: "UAH",
      issuedAt: new Date(now - 6 * DAY),
      dueAt: new Date(now - 1 * DAY),
      paidAt: new Date(now - 5 * DAY),
      items: {
        create: [
          {
            description: "Урок: квадратні рівняння",
            quantity: 1,
            unitAmount: 30000,
            amount: 30000,
            lessonId: completedLesson.id,
          },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      teacherId,
      studentId: anna.id,
      lessonId: completedLesson.id,
      invoiceId: invoice.id,
      amount: 30000,
      currency: "UAH",
      status: PaymentStatus.PAID,
      provider: PaymentProviderKind.LIQPAY,
      providerTransactionId: "seed-liqpay-0001",
      description: "Оплата за урок 07/09",
      paidAt: new Date(now - 5 * DAY),
    },
  });

  await prisma.payment.create({
    data: {
      teacherId,
      studentId: bohdan.id,
      amount: 35000,
      currency: "UAH",
      status: PaymentStatus.PENDING,
      description: "Урок фізики (заплановано)",
      dueAt: new Date(now + 7 * DAY),
    },
  });

  // --- Notifications + chat ----------------------------------
  await prisma.notification.createMany({
    data: [
      {
        userId: anna.id,
        teacherId,
        type: NotificationType.LESSON_REMINDER,
        title: "Завтра урок о 17:00",
        body: "Математика — теорема Вієта",
      },
      {
        userId: bohdan.id,
        teacherId,
        type: NotificationType.PAYMENT_UPCOMING,
        title: "Наближається оплата",
        body: "350,00 ₴ до " + new Date(now + 7 * DAY).toLocaleDateString("uk-UA"),
      },
    ],
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        lessonId: completedLesson.id,
        teacherId,
        senderId: teacher.id,
        senderType: ChatSenderType.TEACHER,
        content: "Аню, поглянь на рівняння 3 ще раз.",
      },
      {
        lessonId: completedLesson.id,
        teacherId,
        senderId: anna.id,
        senderType: ChatSenderType.STUDENT,
        content: "Здається, я переплутала знак у дискримінанті.",
      },
      {
        lessonId: completedLesson.id,
        teacherId,
        senderId: null,
        senderType: ChatSenderType.AI,
        content:
          "Підказка: D = b² − 4ac. Підстав a=2, b=4, c=3 і перевір знак.",
      },
    ],
  });

  console.log("\nSeed complete:");
  console.table([
    { role: "TEACHER", email: teacher.email, password: DEMO_PASSWORD },
    { role: "STUDENT", email: anna.email, password: DEMO_PASSWORD },
    { role: "STUDENT", email: bohdan.email, password: DEMO_PASSWORD },
  ]);
  console.log(`\nPending invite link:\n${APP_URL}/join/${rawToken}\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
