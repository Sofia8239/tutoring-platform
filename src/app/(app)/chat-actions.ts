"use server";

import { z } from "zod";

import { requireUser } from "@/lib/session";
import { getAiProvider } from "@/server/ai/provider";
import {
  assertChatAccess,
  ChatError,
  postAiMessage,
  postChatMessage,
  recentChatTranscript,
} from "@/server/lessons/chat";

export type ChatActionResult = { ok: true } | { ok: false; error: string };

export async function sendChatMessageAction(input: {
  lessonId: string;
  content: string;
}): Promise<ChatActionResult> {
  const user = await requireUser();
  try {
    const ctx = await assertChatAccess(user, input.lessonId);
    await postChatMessage({ ctx, senderId: user.id, content: input.content });
    return { ok: true };
  } catch (error) {
    if (error instanceof ChatError) return { ok: false, error: error.message };
    throw error;
  }
}

const aiReplySchema = z.object({ reply: z.string().min(1).max(4000) });

export async function askAiInChatAction(input: {
  lessonId: string;
  content: string;
}): Promise<ChatActionResult> {
  const user = await requireUser();

  let ctx;
  try {
    ctx = await assertChatAccess(user, input.lessonId);
    if (input.content.trim()) {
      await postChatMessage({ ctx, senderId: user.id, content: input.content });
    }
  } catch (error) {
    if (error instanceof ChatError) return { ok: false, error: error.message };
    throw error;
  }

  const provider = getAiProvider();
  if (!provider) return { ok: false, error: "AI не налаштовано на сервері." };

  try {
    const transcript = await recentChatTranscript(ctx);
    const { value } = await provider.generateStructured({
      schema: aiReplySchema,
      schemaName: "chat_reply",
      system: `Ти — AI-асистент репетитора у чаті уроку «${ctx.subject}». Відповідай коротко й зрозуміло, українською. Допомагай пояснити тему й підвести учня до виконання завдання, але не виконуй усю роботу за нього.`,
      prompt: `Останні повідомлення чату (senderType: текст):\n${transcript}\n\nДай наступну відповідь асистента.`,
      maxTokens: 1200,
    });
    await postAiMessage({ ctx, content: value.reply });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `AI не відповів: ${message}` };
  }
}
