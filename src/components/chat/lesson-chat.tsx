"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { CHAT_SENDER_LABEL } from "@/lib/chat-rules";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import type { ChatSenderType } from "@/generated/prisma/enums";

import {
  askAiInChatAction,
  sendChatMessageAction,
} from "@/app/(app)/chat-actions";

export type ChatMsg = {
  id: string;
  senderType: ChatSenderType;
  senderName: string | null;
  content: string;
  createdAt: string;
  mine: boolean;
};

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LessonChat({
  lessonId,
  initialMessages,
  aiEnabled,
}: {
  lessonId: string;
  initialMessages: ChatMsg[];
  aiEnabled: boolean;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiPending, setAiPending] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAt =
    messages.length > 0 ? messages[messages.length - 1].createdAt : "";

  useEffect(() => {
    const params = lastAt ? `?after=${encodeURIComponent(lastAt)}` : "";
    const es = new EventSource(`/api/lessons/${lessonId}/chat/stream${params}`);
    es.onmessage = (event) => {
      let data: { type?: string; message?: ChatMsg };
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type !== "message" || !data.message) return;
      const incoming = data.message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        // drop the optimistic echo of our own message
        const withoutTemp = prev.filter(
          (m) =>
            !(
              m.id.startsWith("temp-") &&
              m.mine &&
              m.content === incoming.content
            ),
        );
        return [...withoutTemp, incoming];
      });
    };
    es.onerror = () => {
      /* browser auto-reconnects */
    };
    return () => es.close();
    // Reconnect only when the lesson changes, not on every new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function optimistic(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        senderType: "TEACHER" as ChatSenderType,
        senderName: "Ви",
        content,
        createdAt: new Date().toISOString(),
        mine: true,
      },
    ]);
  }

  function send() {
    const content = draft.trim();
    if (!content) return;
    setError(null);
    setDraft("");
    optimistic(content);
    startTransition(async () => {
      const res = await sendChatMessageAction({ lessonId, content });
      if (!res.ok) setError(res.error);
    });
  }

  function askAi() {
    const content = draft.trim();
    setError(null);
    setDraft("");
    if (content) optimistic(content);
    setAiPending(true);
    startTransition(async () => {
      const res = await askAiInChatAction({ lessonId, content });
      setAiPending(false);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="border-line rounded-card bg-surface shadow-soft flex h-[70vh] flex-col border">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted text-sm">Повідомлень ще немає.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}
            >
              <span className="text-muted text-xs">
                {m.mine
                  ? "Ви"
                  : (m.senderName ?? CHAT_SENDER_LABEL[m.senderType])}{" "}
                · {time(m.createdAt)}
              </span>
              <span
                className={`rounded-card mt-0.5 max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.senderType === "AI"
                    ? "bg-tint-lavender"
                    : m.mine
                      ? "bg-primary text-primary-ink"
                      : "bg-surface-2"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))
        )}
        {aiPending ? (
          <p className="text-muted text-xs">AI-асистент друкує…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-line flex flex-col gap-2 border-t p-3">
        {error ? <p className="text-danger text-xs">{error}</p> : null}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Повідомлення… (Enter — надіслати)"
          className={fieldClass}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className={buttonClass("primary", "md")}
          >
            Надіслати
          </button>
          {aiEnabled ? (
            <button
              type="button"
              onClick={askAi}
              disabled={pending || aiPending}
              className={buttonClass("secondary", "md")}
            >
              Запитати AI
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
