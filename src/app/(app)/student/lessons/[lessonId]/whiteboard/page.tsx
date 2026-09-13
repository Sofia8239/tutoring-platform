import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { getWhiteboardForStudent } from "@/server/lessons/whiteboard";
import { WhiteboardCanvas } from "@/components/whiteboard/whiteboard-canvas";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Дошка" };

export default async function StudentWhiteboardPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { lessonId } = await params;

  const board = await getWhiteboardForStudent(user.id, lessonId);
  if (!board) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/student/lessons/${lessonId}`}
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
        name={user.name || user.email || "Учень"}
        role="student"
      />
    </div>
  );
}
