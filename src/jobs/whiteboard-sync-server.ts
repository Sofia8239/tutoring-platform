import "dotenv/config";

import { createServer } from "node:http";

import { WebSocketServer } from "ws";
import { TLSocketRoom, type WebSocketMinimal } from "@tldraw/sync-core";
import { createTLSchema } from "@tldraw/tlschema";
import type { TLRecord, TLStoreSnapshot } from "@tldraw/tlschema";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  MAX_SCENE_BYTES,
  parseIncomingScene,
  roomSnapshotToStoreSnapshot,
  sceneOrUndefined,
} from "@/lib/whiteboard-scene";
import {
  verifyWhiteboardTicket,
  type WhiteboardRole,
} from "@/server/whiteboard-sync/ticket";
import { resolveIsReadonly } from "@/lib/whiteboard-permission";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Whiteboard multiplayer sync (`pnpm run whiteboard-sync`). Its own process,
 * next to `next dev`/`next start` — same shape as `src/jobs/worker.ts` — for
 * one reason: `@tldraw/sync` needs a plain bidirectional WebSocket, and a
 * persistent WS connection isn't something a Next.js Route Handler can hold
 * open. This is *not* a custom Next server (see the App Router "Custom
 * Server" guide) — it's a second, ordinary backend process the app talks to,
 * exactly the pattern that guide points to instead of ejecting Next's own
 * server. SSE (already used for lesson chat) was considered and rejected:
 * it's one-way (server -> client), so it can't carry the student's or
 * teacher's drawing back up — tldraw's own sync protocol needs a real
 * two-way channel, which is what `@tldraw/sync-core` is built for.
 *
 * One `TLSocketRoom` per lesson, kept in memory only while someone is
 * connected. Persistence is intentionally simple for this app's scale (a
 * couple of participants per room): load the last snapshot once when the
 * room is created, debounce-save on every committed change, flush + evict
 * the room once the last participant leaves. This is the same "autosave"
 * contract the old solo editor had — just moved server-side, and now driven
 * by whichever participant is actually drawing.
 */

const SAVE_DEBOUNCE_MS = 1500;
const SAVE_MAX_WAIT_MS = 8_000;

const schema = createTLSchema();

type SessionMeta = { userId: string; role: WhiteboardRole; name: string };

type RoomEntry = {
  room: TLSocketRoom<TLRecord, SessionMeta>;
  teacherId: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  maxWaitTimer: ReturnType<typeof setTimeout> | null;
};

const rooms = new Map<string, RoomEntry>();

async function persist(lessonId: string, entry: RoomEntry): Promise<void> {
  const snapshot = entry.room.getCurrentSnapshot();
  if (snapshot.documents.length === 0) return; // nothing drawn yet

  const storeSnapshot = roomSnapshotToStoreSnapshot(snapshot);
  const parsed = parseIncomingScene(storeSnapshot);
  if (!parsed.ok) {
    console.warn(`[whiteboard-sync] ${lessonId}: not saved — ${parsed.error}`);
    return;
  }

  const sceneJson = parsed.scene as unknown as Prisma.InputJsonValue;
  try {
    await prisma.whiteboard.upsert({
      where: { lessonId },
      create: { lessonId, teacherId: entry.teacherId, sceneJson },
      update: { sceneJson },
    });
  } catch (error) {
    console.error(`[whiteboard-sync] ${lessonId}: save failed`, error);
  }
}

function clearTimers(entry: RoomEntry): void {
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  if (entry.maxWaitTimer) clearTimeout(entry.maxWaitTimer);
  entry.debounceTimer = null;
  entry.maxWaitTimer = null;
}

function scheduleSave(lessonId: string): void {
  const entry = rooms.get(lessonId);
  if (!entry) return;

  if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
  entry.debounceTimer = setTimeout(() => {
    clearTimers(entry);
    void persist(lessonId, entry);
  }, SAVE_DEBOUNCE_MS);

  // Safety net: a continuous drawing session keeps resetting the debounce
  // timer above, so without this a long stroke run would never hit disk
  // until the participant stops. This caps how stale the DB copy can get.
  if (!entry.maxWaitTimer) {
    entry.maxWaitTimer = setTimeout(() => {
      clearTimers(entry);
      void persist(lessonId, entry);
    }, SAVE_MAX_WAIT_MS);
  }
}

async function getOrCreateRoom(lessonId: string): Promise<RoomEntry | null> {
  const existing = rooms.get(lessonId);
  if (existing) return existing;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { teacherId: true, whiteboard: { select: { sceneJson: true } } },
  });
  if (!lesson) return null;

  const initialScene = sceneOrUndefined(lesson.whiteboard?.sceneJson);

  const entry: RoomEntry = {
    teacherId: lesson.teacherId,
    debounceTimer: null,
    maxWaitTimer: null,
    room: new TLSocketRoom<TLRecord, SessionMeta>({
      schema,
      // The DB only ever holds what this same room type wrote (or the old
      // solo editor's `getSnapshot(store).document`, the same shape) —
      // `isWhiteboardScene` already checked the shape; tldraw itself
      // validates/migrates the actual records when it loads the snapshot.
      initialSnapshot: initialScene as unknown as TLStoreSnapshot | undefined,
      onCommittedChanges: () => scheduleSave(lessonId),
      onSessionRemoved: (room, { numSessionsRemaining }) => {
        if (numSessionsRemaining > 0) return;
        const current = rooms.get(lessonId);
        if (!current) return;
        clearTimers(current);
        void persist(lessonId, current).finally(() => {
          rooms.delete(lessonId);
          room.close();
        });
      },
    }),
  };

  rooms.set(lessonId, entry);
  return entry;
}

/**
 * Fresh per-connect read of the teacher's toggle — deliberately NOT cached
 * on `RoomEntry` (which may have been created long before this connect) and
 * NOT trusted from the ticket. This is the actual value fed into
 * `resolveIsReadonly` for every new student session.
 */
async function getStudentCanEdit(lessonId: string): Promise<boolean> {
  const whiteboard = await prisma.whiteboard.findUnique({
    where: { lessonId },
    select: { studentCanEdit: true },
  });
  return whiteboard?.studentCanEdit ?? true;
}

/** Drop every currently-connected student session in a lesson's room (if any
 *  is open). They reconnect automatically and pick up the fresh
 *  `studentCanEdit` value on the way back in. */
function kickStudentSessions(lessonId: string): void {
  const entry = rooms.get(lessonId);
  if (!entry) return; // nobody connected — nothing to kick, next connect reads fresh anyway
  for (const session of entry.room.getSessions()) {
    if (session.meta.role === "student") {
      entry.room.closeSession(session.sessionId);
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket upgrade
// ---------------------------------------------------------------------------

function readJsonBody(
  req: import("node:http").IncomingMessage,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(
          chunks.length
            ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
            : {},
        );
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const httpServer = createServer((req, res) => {
  // Internal-only: called by the Next.js app (same host) right after it
  // persists a `studentCanEdit` change, never by a browser. Gated by a
  // shared secret, not exposed in any client bundle.
  if (req.method === "POST" && req.url === "/internal/kick-student") {
    const secret = env.WHITEBOARD_SYNC_SECRET ?? env.AUTH_SECRET;
    if (req.headers["x-internal-secret"] !== secret) {
      res.writeHead(401).end();
      return;
    }
    void readJsonBody(req)
      .then((body) => {
        const lessonId = (body as { lessonId?: unknown }).lessonId;
        if (typeof lessonId === "string") kickStudentSessions(lessonId);
        res.writeHead(204).end();
      })
      .catch(() => res.writeHead(400).end());
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" });
  res.end("whiteboard-sync ok");
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://internal");
  const match = /^\/room\/([^/]+)$/.exec(url.pathname);
  const ticketRaw = url.searchParams.get("ticket");
  const sessionId = url.searchParams.get("sessionId");

  if (!match || !ticketRaw || !sessionId) {
    socket.destroy();
    return;
  }

  const lessonId = decodeURIComponent(match[1]);
  const secret = env.WHITEBOARD_SYNC_SECRET ?? env.AUTH_SECRET;
  const payload = verifyWhiteboardTicket(ticketRaw, secret, lessonId);
  if (!payload) {
    socket.destroy();
    return;
  }

  // Resolve the room BEFORE completing the WS handshake, not after: the
  // client sends its `connect` message the instant the socket opens, and
  // `TLSocketRoom` only starts listening for messages inside
  // `handleSocketConnect`. Awaiting the DB lookup *after* `handleUpgrade`
  // leaves a window where that first (and only) `connect` message arrives
  // with nobody listening yet and is silently dropped — the client then
  // waits forever for a reply that was never coming. Doing the lookup first
  // means `handleSocketConnect` runs synchronously right as the socket opens.
  void (async () => {
    let entry: RoomEntry | null;
    let studentCanEdit = true;
    try {
      // Teacher connections never need this lookup (always editable), so
      // only fetch it for a student — and always fresh, never from the room
      // entry, which may have been created long before this connect.
      [entry, studentCanEdit] = await Promise.all([
        getOrCreateRoom(lessonId),
        payload.role === "student" ? getStudentCanEdit(lessonId) : true,
      ]);
    } catch (error) {
      console.error(`[whiteboard-sync] ${lessonId}: room lookup failed`, error);
      socket.destroy();
      return;
    }
    if (!entry) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      entry.room.handleSocketConnect({
        sessionId,
        socket: ws as unknown as WebSocketMinimal,
        // The actual enforcement: a session opened with isReadonly:true
        // cannot push document changes, independent of what the client's
        // own UI does or fakes locally.
        isReadonly: resolveIsReadonly(payload.role, studentCanEdit),
        meta: {
          userId: payload.userId,
          role: payload.role,
          name: payload.name,
        },
      });
    });
  })();
});

httpServer.listen(env.WHITEBOARD_SYNC_PORT, () => {
  console.log(
    `[whiteboard-sync] listening on :${env.WHITEBOARD_SYNC_PORT} (max scene ${MAX_SCENE_BYTES} bytes)`,
  );
});

const shutdown = () => {
  console.log("[whiteboard-sync] shutting down…");
  const flushes: Promise<void>[] = [];
  for (const [lessonId, entry] of rooms) {
    clearTimers(entry);
    flushes.push(persist(lessonId, entry));
  }
  void Promise.allSettled(flushes).finally(() => {
    wss.close();
    httpServer.close(() => process.exit(0));
    // Force-exit if a stuck connection keeps the server from closing.
    setTimeout(() => process.exit(0), 3000).unref();
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
