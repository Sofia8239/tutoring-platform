import { getSessionUser } from "@/lib/session";
import { assertChatAccess, listChatMessages } from "@/server/lessons/chat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 2000;

/**
 * Server-Sent Events stream of new chat messages for a lesson. Tails the DB —
 * no external pub/sub. Only the lesson's teacher or student may connect.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ lessonId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { lessonId } = await ctx.params;

  let chat;
  try {
    chat = await assertChatAccess(user, lessonId);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const afterParam = new URL(request.url).searchParams.get("after");
  let cursor = afterParam ? new Date(afterParam) : null;
  if (cursor && Number.isNaN(cursor.getTime())) cursor = null;
  // No cursor -> start from "now" (the page already rendered the backlog).
  let since = cursor ?? new Date();

  const encoder = new TextEncoder();
  const viewerId = user.id;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      const tick = async () => {
        if (closed) return;
        try {
          const messages = await listChatMessages(chat, viewerId, {
            after: since,
          });
          for (const m of messages) {
            send({ type: "message", message: m });
            since = m.createdAt;
          }
          send({ type: "ping", t: Date.now() });
        } catch {
          /* transient DB error — retry next tick */
        }
      };

      const interval = setInterval(tick, POLL_MS);
      void tick();

      const abort = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
