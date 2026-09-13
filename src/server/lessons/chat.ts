import "server-only";

import { prisma } from "@/lib/prisma";
import { resolveTenantId } from "@/lib/tenant";
import { chatSenderTypeForRole, validateChatMessage } from "@/lib/chat-rules";
import { ChatSenderType, UserRole } from "@/generated/prisma/enums";

/**
 * Lesson chat. A thread belongs to one lesson; only that lesson's teacher (the
 * tenant owner) and its student may read or post. Every query is scoped to the
 * lesson AND the caller's participant identity.
 */

export class ChatError extends Error {}

type ChatUser = {
  id: string;
  role: UserRole;
  tenantId: string | null;
};

export type ChatContext = {
  lessonId: string;
  teacherId: string;
  studentId: string;
  subject: string;
  role: UserRole;
};

/** Throws unless `user` is the teacher or the student of `lessonId`. */
export async function assertChatAccess(
  user: ChatUser,
  lessonId: string,
): Promise<ChatContext> {
  const where =
    user.role === UserRole.STUDENT
      ? { id: lessonId, studentId: user.id }
      : { id: lessonId, teacherId: resolveTenantId(user) };

  const lesson = await prisma.lesson.findFirst({
    where,
    select: { id: true, teacherId: true, studentId: true, subject: true },
  });
  if (!lesson) {
    throw new ChatError("Чат недоступний.");
  }
  return {
    lessonId: lesson.id,
    teacherId: lesson.teacherId,
    studentId: lesson.studentId,
    subject: lesson.subject,
    role: user.role,
  };
}

export type ChatMessageView = {
  id: string;
  senderType: ChatSenderType;
  senderName: string | null;
  content: string;
  createdAt: Date;
  mine: boolean;
};

export async function listChatMessages(
  ctx: ChatContext,
  viewerId: string,
  options: { after?: Date; limit?: number } = {},
): Promise<ChatMessageView[]> {
  const rows = await prisma.chatMessage.findMany({
    where: {
      lessonId: ctx.lessonId,
      ...(options.after ? { createdAt: { gt: options.after } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 200,
    select: {
      id: true,
      senderType: true,
      senderId: true,
      content: true,
      createdAt: true,
      sender: { select: { name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    senderType: row.senderType,
    senderName:
      row.senderType === ChatSenderType.AI
        ? null
        : (row.sender?.name ?? row.sender?.email ?? null),
    content: row.content,
    createdAt: row.createdAt,
    mine: row.senderId === viewerId,
  }));
}

export async function postChatMessage(input: {
  ctx: ChatContext;
  senderId: string;
  content: string;
}): Promise<{ id: string }> {
  const issue = validateChatMessage(input.content);
  if (issue === "empty") throw new ChatError("Порожнє повідомлення.");
  if (issue === "too-long") throw new ChatError("Повідомлення задовге.");

  return prisma.chatMessage.create({
    data: {
      lessonId: input.ctx.lessonId,
      teacherId: input.ctx.teacherId,
      senderId: input.senderId,
      senderType: chatSenderTypeForRole(input.ctx.role),
      content: input.content.trim(),
    },
    select: { id: true },
  });
}

export async function postAiMessage(input: {
  ctx: ChatContext;
  content: string;
}): Promise<{ id: string }> {
  return prisma.chatMessage.create({
    data: {
      lessonId: input.ctx.lessonId,
      teacherId: input.ctx.teacherId,
      senderId: null,
      senderType: ChatSenderType.AI,
      content: input.content.trim().slice(0, 8000),
    },
    select: { id: true },
  });
}

/** Recent messages as plain text, for feeding the AI a bit of context. */
export async function recentChatTranscript(
  ctx: ChatContext,
  take = 12,
): Promise<string> {
  const rows = await prisma.chatMessage.findMany({
    where: { lessonId: ctx.lessonId },
    orderBy: { createdAt: "desc" },
    take,
    select: { senderType: true, content: true },
  });
  return rows
    .reverse()
    .map((r) => `${r.senderType}: ${r.content}`)
    .join("\n");
}
