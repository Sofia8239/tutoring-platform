import { ChatSenderType, UserRole } from "@/generated/prisma/enums";

/**
 * Pure lesson-chat rules — no DB, no `next/*`. A lesson thread has three kinds
 * of author; a human message maps from the sender's role.
 */

export const MAX_CHAT_MESSAGE_LENGTH = 4000;

export function chatSenderTypeForRole(role: UserRole): ChatSenderType {
  return role === UserRole.STUDENT
    ? ChatSenderType.STUDENT
    : ChatSenderType.TEACHER;
}

export type ChatMessageIssue = "empty" | "too-long";

export function validateChatMessage(content: string): ChatMessageIssue | null {
  const trimmed = content.trim();
  if (!trimmed) return "empty";
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return "too-long";
  return null;
}

export const CHAT_SENDER_LABEL: Record<ChatSenderType, string> = {
  [ChatSenderType.TEACHER]: "Викладач",
  [ChatSenderType.STUDENT]: "Учень",
  [ChatSenderType.AI]: "AI-асистент",
};
