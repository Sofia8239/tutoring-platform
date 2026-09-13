import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, signed room-join ticket for the whiteboard multiplayer sync
 * process (`src/jobs/whiteboard-sync-server.ts`).
 *
 * The Next.js side already knows how to authenticate a request (session
 * cookie) and check tenant/lesson membership; the standalone WS process has
 * neither. Rather than duplicate Auth.js's session verification in a second
 * process, a Route Handler does that check once and hands out a ticket that
 * encodes its *result* — `{ lessonId, userId, role }` — signed with a server
 * secret and valid for a few seconds, just long enough to complete the socket
 * handshake. The WS server only ever has to verify a signature and an
 * expiry, never touch the session/DB to authenticate a connection, and
 * `@tldraw/sync`'s `uri` is re-invoked on every (re)connect attempt, so a
 * fresh ticket — and a fresh DB check — happens automatically on reconnect.
 *
 * No `server-only`: both the Route Handler (Next) and the standalone `tsx`
 * process import this directly.
 */

const DEFAULT_TTL_SECONDS = 60;

export type WhiteboardRole = "teacher" | "student";

export type WhiteboardTicketPayload = {
  lessonId: string;
  userId: string;
  role: WhiteboardRole;
  name: string;
};

type SignedPayload = WhiteboardTicketPayload & { exp: number };

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payloadB64).digest());
}

export function mintWhiteboardTicket(
  payload: WhiteboardTicketPayload,
  opts: { secret: string; ttlSeconds?: number },
): string {
  const signed: SignedPayload = {
    ...payload,
    exp:
      Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const payloadB64 = base64url(JSON.stringify(signed));
  return `${payloadB64}.${sign(payloadB64, opts.secret)}`;
}

/**
 * Verify a ticket's signature and expiry, and — critically — that it was
 * minted for `expectedLessonId`. Without that last check a ticket for lesson
 * A's room would double as a valid ticket for lesson B's, since the signature
 * alone doesn't say which room the caller is trying to join.
 */
export function verifyWhiteboardTicket(
  raw: string,
  secret: string,
  expectedLessonId: string,
): WhiteboardTicketPayload | null {
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const givenSig = raw.slice(dot + 1);
  const expectedSig = sign(payloadB64, secret);

  const a = Buffer.from(givenSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: SignedPayload;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof parsed.lessonId !== "string" ||
    typeof parsed.userId !== "string" ||
    (parsed.role !== "teacher" && parsed.role !== "student") ||
    typeof parsed.name !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  if (parsed.lessonId !== expectedLessonId) return null;

  const { lessonId, userId, role, name } = parsed;
  return { lessonId, userId, role, name };
}
