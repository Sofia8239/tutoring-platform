import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { isAiConfigured } from "@/server/ai/provider";
import { assertChatAccess, listChatMessages } from "@/server/lessons/chat";
import { LessonChat } from "@/components/chat/lesson-chat";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Чат уроку" };

export default async function StudentLessonChatPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { lessonId } = await params;

  let chat;
  try {
    chat = await assertChatAccess(user, lessonId);
  } catch {
    notFound();
  }

  const messages = await listChatMessages(chat, user.id, { limit: 200 });

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
          Чат · {chat.subject}
        </h1>
      </div>

      <LessonChat
        lessonId={lessonId}
        aiEnabled={isAiConfigured()}
        initialMessages={messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
