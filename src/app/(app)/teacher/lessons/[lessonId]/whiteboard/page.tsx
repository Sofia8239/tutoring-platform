import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { getWhiteboardForTeacher } from "@/server/lessons/whiteboard";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
import { UserRole } from "@/generated/prisma/enums";

import { toggleStudentCanEditAction } from "./actions";

export const metadata: Metadata = { title: "Дошка" };

export default async function TeacherWhiteboardPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await params;

  const board = await getWhiteboardForTeacher(teacherId, lessonId);
  if (!board) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/teacher/lessons/${lessonId}`}
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроку
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Дошка · {board.lessonSubject}
        </h1>
      </div>

      <WhiteboardCanvas
        lessonId={board.lessonId}
        userId={user.id}
        name={user.name || user.email || "Викладач"}
        role="teacher"
        initialCanEdit={board.studentCanEdit}
        toggleAction={toggleStudentCanEditAction}
      />
    </div>
  );
}
