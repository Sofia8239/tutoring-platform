import "server-only";

import { prisma } from "@/lib/prisma";
import { sceneOrUndefined, type WhiteboardScene } from "@/lib/whiteboard-scene";
import type { SessionUser } from "@/lib/session";
import type { WhiteboardRole } from "@/server/whiteboard-sync/ticket";
import { notifyWhiteboardPermissionChanged } from "@/server/whiteboard-sync/notify";

/**
 * Per-lesson tldraw whiteboard. One row per lesson (`Whiteboard.lessonId` is
 * unique). Both the teacher and the lesson's student now edit it together in
 * real time (see `src/jobs/whiteboard-sync-server.ts`, which owns writing
 * `sceneJson`); this module covers reads, the teacher-only edit-permission
 * toggle, and the participant check that gates a sync-room ticket. Every
 * query is scoped by the owning teacher / participating student.
 */

export class WhiteboardError extends Error {}

export type WhiteboardView = {
  lessonId: string;
  lessonSubject: string;
  scene: WhiteboardScene | undefined;
  updatedAt: Date | null;
  /** Teacher-controlled: can the student currently edit the board? */
  studentCanEdit: boolean;
};

async function loadWhiteboard(
  lessonWhere:
    { id: string; teacherId: string } | { id: string; studentId: string },
): Promise<WhiteboardView | null> {
  const lesson = await prisma.lesson.findFirst({
    where: lessonWhere,
    select: {
      id: true,
      subject: true,
      whiteboard: {
        select: { sceneJson: true, updatedAt: true, studentCanEdit: true },
      },
    },
  });
  if (!lesson) return null;

  return {
    lessonId: lesson.id,
    lessonSubject: lesson.subject,
    scene: sceneOrUndefined(lesson.whiteboard?.sceneJson),
    updatedAt: lesson.whiteboard?.updatedAt ?? null,
    // No Whiteboard row yet (nobody has opened the board) means the default:
    // shared editing on, matching the DB column's own default.
    studentCanEdit: lesson.whiteboard?.studentCanEdit ?? true,
  };
}

export function getWhiteboardForTeacher(
  teacherId: string,
  lessonId: string,
): Promise<WhiteboardView | null> {
  return loadWhiteboard({ id: lessonId, teacherId });
}

export function getWhiteboardForStudent(
  studentId: string,
  lessonId: string,
): Promise<WhiteboardView | null> {
  return loadWhiteboard({ id: lessonId, studentId });
}

/**
 * Flip whether the student may edit the shared board. Teacher-only (the
 * caller must already be scoped to `teacherId`, same as everywhere else).
 * Persists first, then best-effort-notifies the sync process so an
 * already-connected student is kicked (and reconnects picking up the new
 * value) instead of waiting for their session to end on its own.
 */
export async function setStudentCanEdit(
  teacherId: string,
  lessonId: string,
  canEdit: boolean,
): Promise<void> {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, teacherId },
    select: { id: true },
  });
  if (!lesson) {
    throw new WhiteboardError("Урок не знайдено.");
  }

  await prisma.whiteboard.upsert({
    where: { lessonId },
    create: { lessonId, teacherId, studentCanEdit: canEdit },
    update: { studentCanEdit: canEdit },
  });

  await notifyWhiteboardPermissionChanged(lessonId);
}

/**
 * Is `user` the teacher or the student of this lesson, in their own tenant?
 * The single gate for a whiteboard sync-room ticket (golden rule 7: scoped by
 * tenant, never just by "is this a valid lesson id"). Returns `null` for
 * anyone else, including a different teacher's own student.
 *
 * `canEdit` here is for the client's own immediate UX (banner, local
 * read-only hint) ONLY — it is not the security boundary. The sync process
 * re-derives it independently, fresh, at the moment a socket actually
 * connects (see resolveIsReadonly / whiteboard-sync-server.ts); a value
 * carried in a ticket minted a few seconds earlier is not trusted for that.
 */
export async function assertWhiteboardParticipant(
  user: SessionUser,
  lessonId: string,
): Promise<{ role: WhiteboardRole; canEdit: boolean } | null> {
  if (user.role === "TEACHER") {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, teacherId: user.id },
      select: { id: true },
    });
    return lesson ? { role: "teacher", canEdit: true } : null;
  }

  if (user.role === "STUDENT") {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, studentId: user.id },
      select: { id: true, whiteboard: { select: { studentCanEdit: true } } },
    });
    if (!lesson) return null;
    return {
      role: "student",
      canEdit: lesson.whiteboard?.studentCanEdit ?? true,
    };
  }

  return null;
}
