import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { requireUser } from "@/lib/session";
import { assertWhiteboardParticipant } from "@/server/lessons/whiteboard";
import { mintWhiteboardTicket } from "@/server/whiteboard-sync/ticket";

export const dynamic = "force-dynamic";

/**
 * Mint a short-lived ticket to join a lesson's whiteboard sync room. This is
 * the ONLY place that decides who may join which room: it re-checks — on
 * every call, i.e. on every (re)connect since `@tldraw/sync`'s `uri` option is
 * re-invoked each attempt — that the signed-in user is the teacher or the
 * student of THIS lesson, in their own tenant. The WS process trusts the
 * ticket's signature alone; it never touches auth or the tenant model.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireUser();
  const { lessonId } = await ctx.params;

  const participant = await assertWhiteboardParticipant(user, lessonId);
  if (!participant) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const ticket = mintWhiteboardTicket(
    {
      lessonId,
      userId: user.id,
      role: participant.role,
      name: user.name || user.email || "Учасник",
    },
    { secret: env.WHITEBOARD_SYNC_SECRET ?? env.AUTH_SECRET },
  );

  // `canEdit` is UX-only (drives the client's banner / local read-only
  // hint) — see the doc comment on assertWhiteboardParticipant.
  return NextResponse.json({ ticket, canEdit: participant.canEdit });
}
