import { env } from "@/lib/env";

/**
 * Best-effort ping to the whiteboard sync process (src/jobs/whiteboard-sync-server.ts)
 * telling it a lesson's `studentCanEdit` changed, so it can immediately drop
 * any currently-connected student session — forcing a reconnect, which is
 * how a live permission change actually takes effect (the sync room only
 * decides `isReadonly` once, at connect time; see resolveIsReadonly).
 *
 * Fire-and-forget on purpose: the DB write already happened by the time this
 * runs, so if the sync process is down or unreachable, the change still
 * takes effect on this lesson's *next* connection — it just doesn't kick an
 * already-open session immediately. No `server-only`: called from a Server
 * Action, which is fine either way, but this stays reusable from a script.
 */
export async function notifyWhiteboardPermissionChanged(
  lessonId: string,
): Promise<void> {
  const secret = env.WHITEBOARD_SYNC_SECRET ?? env.AUTH_SECRET;
  const url = `http://localhost:${env.WHITEBOARD_SYNC_PORT}/internal/kick-student`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ lessonId }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Sync process not running / unreachable — see the doc comment above.
  }
}
