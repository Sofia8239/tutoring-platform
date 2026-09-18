import "server-only";

import { prisma } from "@/lib/prisma";
import { formatInZone } from "@/lib/datetime";
import { LessonStatus, UserRole } from "@/generated/prisma/enums";
import {
  canTransitionLesson,
  timestampFieldForStatus,
  validateLessonWindow,
} from "@/server/lessons/lesson-rules";

/**
 * Lesson domain service. Route Handlers / Server Actions stay thin: they parse
 * input and call one of these. Every query is scoped by `teacherId` (the tenant
 * key, golden rule 7); nothing here imports `next/*`.
 */

/** Thrown for user-fixable problems (overlap, bad window, wrong state). */
export class LessonValidationError extends Error {}

export type LessonPerson = {
  id: string;
  name: string | null;
  email: string;
};

export type LessonDTO = {
  id: string;
  subject: string;
  disciplineKey: string | null;
  status: LessonStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  price: number;
  currency: string;
  meetLink: string | null;
  notes: string | null;
  /** "What happened in the lesson" — see schema.prisma for the notes/summary split. */
  summary: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  student: LessonPerson;
  teacher: LessonPerson;
};

export type LessonInput = {
  studentId: string;
  subject: string;
  /** Explicit discipline override; `null`/omitted inherits the teacher's primary. */
  disciplineKey?: string | null;
  /** UTC instant. */
  scheduledStart: Date;
  /** UTC instant. */
  scheduledEnd: Date;
  /** Integer minor units (kopiykas). */
  price: number;
  currency?: string;
  notes?: string | null;
  /** Permanent video-room link. Already normalised (`http(s)` or `null`). */
  meetLink?: string | null;
};

const LESSON_INCLUDE = {
  student: { select: { id: true, name: true, email: true } },
  teacher: { select: { id: true, name: true, email: true } },
} as const;

type LessonRow = {
  id: string;
  subject: string;
  disciplineKey: string | null;
  status: LessonStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  price: number;
  currency: string;
  meetLink: string | null;
  notes: string | null;
  summary: string | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  student: LessonPerson;
  teacher: LessonPerson;
};

function toDTO(row: LessonRow): LessonDTO {
  return {
    id: row.id,
    subject: row.subject,
    disciplineKey: row.disciplineKey,
    status: row.status,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    price: row.price,
    currency: row.currency,
    meetLink: row.meetLink,
    notes: row.notes,
    summary: row.summary,
    cancellationReason: row.cancellationReason,
    completedAt: row.completedAt,
    cancelledAt: row.cancelledAt,
    student: row.student,
    teacher: row.teacher,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type TeacherLessonScope = "upcoming" | "past" | "all";

export async function listLessonsForTeacher(
  teacherId: string,
  options: {
    scope?: TeacherLessonScope;
    now?: Date;
    /** Restrict to one student — the teacher's view of a single student's cabinet. */
    studentId?: string;
  } = {},
): Promise<LessonDTO[]> {
  const scope = options.scope ?? "all";
  const now = options.now ?? new Date();

  const isUpcoming = {
    status: LessonStatus.SCHEDULED,
    scheduledStart: { gte: now },
  } as const;

  const rows = await prisma.lesson.findMany({
    where: {
      teacherId,
      ...(options.studentId ? { studentId: options.studentId } : {}),
      ...(scope === "upcoming" ? isUpcoming : {}),
      ...(scope === "past" ? { NOT: isUpcoming } : {}),
    },
    orderBy: { scheduledStart: scope === "upcoming" ? "asc" : "desc" },
    include: LESSON_INCLUDE,
  });

  return rows.map(toDTO);
}

/**
 * Every lesson whose start falls in the half-open UTC window `[from, to)`,
 * any status — feeds the week calendar grid. Scoped by `teacherId`.
 */
export async function listLessonsForTeacherRange(
  teacherId: string,
  range: { from: Date; to: Date },
): Promise<LessonDTO[]> {
  const rows = await prisma.lesson.findMany({
    where: {
      teacherId,
      scheduledStart: { gte: range.from, lt: range.to },
    },
    orderBy: { scheduledStart: "asc" },
    include: LESSON_INCLUDE,
  });
  return rows.map(toDTO);
}

export async function listLessonsForStudent(
  studentId: string,
  options: { scope?: TeacherLessonScope; now?: Date } = {},
): Promise<LessonDTO[]> {
  const scope = options.scope ?? "all";
  const now = options.now ?? new Date();

  const isUpcoming = {
    status: LessonStatus.SCHEDULED,
    scheduledStart: { gte: now },
  } as const;

  const rows = await prisma.lesson.findMany({
    where: {
      studentId,
      ...(scope === "upcoming" ? isUpcoming : {}),
      ...(scope === "past" ? { NOT: isUpcoming } : {}),
    },
    orderBy: { scheduledStart: scope === "upcoming" ? "asc" : "desc" },
    include: LESSON_INCLUDE,
  });
  return rows.map(toDTO);
}

export async function getLessonForTeacher(
  teacherId: string,
  lessonId: string,
): Promise<LessonDTO | null> {
  const row = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    include: LESSON_INCLUDE,
  });
  return row ? toDTO(row) : null;
}

export async function getLessonForStudent(
  studentId: string,
  lessonId: string,
): Promise<LessonDTO | null> {
  const row = await prisma.lesson.findFirst({
    where: { id: lessonId, studentId },
    include: LESSON_INCLUDE,
  });
  return row ? toDTO(row) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const WINDOW_MESSAGES = {
  "end-before-start": "Кінець уроку має бути пізніше за початок.",
  "too-short": "Урок має тривати щонайменше 15 хвилин.",
  "too-long": "Урок не може бути довшим за 8 годин.",
} as const;

/**
 * Shared checks for create / update: valid window, the student is in this
 * tenant, and the slot does not clash with another scheduled lesson.
 */
async function assertBookable(
  teacherId: string,
  input: LessonInput,
  excludeLessonId: string | undefined,
  timezone: string,
): Promise<void> {
  const windowIssue = validateLessonWindow(
    input.scheduledStart,
    input.scheduledEnd,
  );
  if (windowIssue) {
    throw new LessonValidationError(WINDOW_MESSAGES[windowIssue]);
  }

  if (!Number.isInteger(input.price) || input.price < 0) {
    throw new LessonValidationError("Некоректна ціна уроку.");
  }

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, tenantId: teacherId, role: UserRole.STUDENT },
    select: { id: true },
  });
  if (!student) {
    throw new LessonValidationError("Такого учня немає серед ваших учнів.");
  }

  const clash = await prisma.lesson.findFirst({
    where: {
      teacherId,
      status: LessonStatus.SCHEDULED,
      ...(excludeLessonId ? { id: { not: excludeLessonId } } : {}),
      // half-open overlap: existing.start < new.end AND existing.end > new.start
      scheduledStart: { lt: input.scheduledEnd },
      scheduledEnd: { gt: input.scheduledStart },
    },
    orderBy: { scheduledStart: "asc" },
    select: { scheduledStart: true, subject: true },
  });
  if (clash) {
    const when = formatInZone(clash.scheduledStart, timezone);
    throw new LessonValidationError(
      `Час перетинається з уроком «${clash.subject}» (${when}).`,
    );
  }
}

export async function createLesson(
  teacherId: string,
  input: LessonInput,
  timezone = "Europe/Kyiv",
): Promise<LessonDTO> {
  await assertBookable(teacherId, input, undefined, timezone);

  const row = await prisma.lesson.create({
    data: {
      teacherId,
      studentId: input.studentId,
      subject: input.subject.trim(),
      disciplineKey: input.disciplineKey?.trim() || null,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      price: input.price,
      currency: input.currency ?? "UAH",
      notes: input.notes?.trim() || null,
      meetLink: input.meetLink?.trim() || null,
    },
    include: LESSON_INCLUDE,
  });

  return toDTO(row);
}

export async function updateLesson(
  teacherId: string,
  lessonId: string,
  input: LessonInput,
  timezone = "Europe/Kyiv",
): Promise<LessonDTO> {
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: { status: true },
  });
  if (!existing) {
    throw new LessonValidationError("Урок не знайдено.");
  }
  if (existing.status !== LessonStatus.SCHEDULED) {
    throw new LessonValidationError("Редагувати можна лише запланований урок.");
  }

  await assertBookable(teacherId, input, lessonId, timezone);

  const row = await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      studentId: input.studentId,
      subject: input.subject.trim(),
      disciplineKey: input.disciplineKey?.trim() || null,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      price: input.price,
      currency: input.currency ?? "UAH",
      notes: input.notes?.trim() || null,
      meetLink: input.meetLink?.trim() || null,
    },
    include: LESSON_INCLUDE,
  });

  return toDTO(row);
}

/**
 * Set (or clear) "what happened in the lesson" — independent of the full
 * edit form and not restricted to SCHEDULED lessons, since it's most useful
 * once a lesson is COMPLETED.
 */
export async function updateLessonSummary(
  teacherId: string,
  lessonId: string,
  summary: string | null,
): Promise<void> {
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: { id: true },
  });
  if (!existing) throw new LessonValidationError("Урок не знайдено.");

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { summary: summary?.trim() || null },
  });
}

export async function changeLessonStatus(input: {
  teacherId: string;
  lessonId: string;
  status: LessonStatus;
  actorId: string;
  cancellationReason?: string | null;
}): Promise<LessonDTO> {
  const existing = await prisma.lesson.findFirst({
    where: { id: input.lessonId, teacherId: input.teacherId },
    select: { status: true },
  });
  if (!existing) {
    throw new LessonValidationError("Урок не знайдено.");
  }
  if (!canTransitionLesson(existing.status, input.status)) {
    throw new LessonValidationError(
      `Неможливо змінити статус з «${existing.status}» на «${input.status}».`,
    );
  }

  const data: Record<string, unknown> = { status: input.status };
  const stampField = timestampFieldForStatus(input.status);
  if (stampField) data[stampField] = new Date();
  if (input.status === LessonStatus.CANCELLED) {
    data.cancelledById = input.actorId;
    data.cancellationReason = input.cancellationReason?.trim() || null;
  }

  const row = await prisma.lesson.update({
    where: { id: input.lessonId },
    data,
    include: LESSON_INCLUDE,
  });

  return toDTO(row);
}

/** The Google Calendar pointers captured before the row (and its cascade) is gone. */
export type DeletedLessonResult = {
  googleEventId: string | null;
  googleCalendarId: string | null;
};

export async function deleteLesson(
  teacherId: string,
  lessonId: string,
): Promise<DeletedLessonResult> {
  const existing = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: {
      status: true,
      calendarEvent: {
        select: { googleEventId: true, googleCalendarId: true },
      },
    },
  });
  if (!existing) {
    throw new LessonValidationError("Урок не знайдено.");
  }
  if (existing.status === LessonStatus.COMPLETED) {
    throw new LessonValidationError(
      "Проведений урок не можна видалити — він потрібен для історії та звітності.",
    );
  }

  await prisma.lesson.delete({ where: { id: lessonId } });

  return {
    googleEventId: existing.calendarEvent?.googleEventId ?? null,
    googleCalendarId: existing.calendarEvent?.googleCalendarId ?? null,
  };
}
