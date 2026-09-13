import "server-only";

import { prisma } from "@/lib/prisma";
import { sceneOrUndefined, type WhiteboardScene } from "@/lib/whiteboard-scene";
import type { SessionUser } from "@/lib/session";
import type { WhiteboardRole } from "@/server/whiteboard-sync/ticket";

/**
 * Per-lesson tldraw whiteboard. One row per lesson (`Whiteboard.lessonId` is
 * unique). Both the teacher and the lesson's student now edit it together in
 * real time (see `src/jobs/whiteboard-sync-server.ts`, which owns writing
 * `sceneJson`); this module only covers reads and the participant check that
 * gates a sync-room ticket. Every query is scoped by the owning teacher /
 * participating student.
 */

export type WhiteboardView = {
  lessonId: string;
  lessonSubject: string;
  scene: WhiteboardScene | undefined;
  updatedAt: Date | null;
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
      whiteboard: { select: { sceneJson: true, updatedAt: true } },
    },
  });
  if (!lesson) return null;

  return {
    lessonId: lesson.id,
    lessonSubject: lesson.subject,
    scene: sceneOrUndefined(lesson.whiteboard?.sceneJson),
    updatedAt: lesson.whiteboard?.updatedAt ?? null,
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
 * Is `user` the teacher or the student of this lesson, in their own tenant?
 * The single gate for a whiteboard sync-room ticket (golden rule 7: scoped by
 * tenant, never just by "is this a valid lesson id"). Returns `null` for
 * anyone else, including a different teacher's own student.
 */
export async function assertWhiteboardParticipant(
  user: SessionUser,
  lessonId: string,
): Promise<{ role: WhiteboardRole } | null> {
  if (user.role === "TEACHER") {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, teacherId: user.id },
      select: { id: true },
    });
    return lesson ? { role: "teacher" } : null;
  }

  if (user.role === "STUDENT") {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, studentId: user.id },
      select: { id: true },
    });
    return lesson ? { role: "student" } : null;
  }

  return null;
}
