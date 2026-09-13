/**
 * Whiteboard scene = a tldraw *document* snapshot (`getSnapshot(store).document`,
 * shape `{ schema, store }`). We persist only the document, never per-viewer
 * session state (camera, selection), and cap its size so one lesson can't store
 * an unbounded blob.
 */

/** Reject snapshots larger than this once serialised (bytes). */
export const MAX_SCENE_BYTES = 3_000_000;

export type WhiteboardScene = {
  schema: unknown;
  store: Record<string, unknown>;
};

/** A tldraw document snapshot has a `store` map and a `schema`. */
export function isWhiteboardScene(value: unknown): value is WhiteboardScene {
  return (
    typeof value === "object" &&
    value !== null &&
    "store" in value &&
    typeof (value as { store: unknown }).store === "object" &&
    (value as { store: unknown }).store !== null
  );
}

export function sceneByteLength(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
}

/** `{}` / `null` from the DB default means "no scene yet". */
export function sceneOrUndefined(value: unknown): WhiteboardScene | undefined {
  return isWhiteboardScene(value) ? value : undefined;
}

/**
 * The multiplayer sync room (`TLSocketRoom.getCurrentSnapshot()`) hands back a
 * different shape — `{ documents: [{ state, lastChangedClock }], schema }` —
 * than the document snapshot we've always persisted (`{ schema, store }`, a
 * plain id -> record map). Converting keeps `Whiteboard.sceneJson` in the one
 * shape every reader already expects (`whiteboardToPlainText`, the PDF/print
 * paths, `isWhiteboardScene`), so switching the write side to the sync room
 * doesn't ripple out to them.
 */
export function roomSnapshotToStoreSnapshot(roomSnapshot: {
  schema?: unknown;
  documents: Array<{ state: object }>;
}): WhiteboardScene {
  const store: Record<string, unknown> = {};
  for (const { state } of roomSnapshot.documents) {
    const id = (state as { id?: unknown }).id;
    if (typeof id === "string") store[id] = state;
  }
  return { schema: roomSnapshot.schema ?? null, store };
}

export type ParsedScene =
  { ok: true; scene: WhiteboardScene } | { ok: false; error: string };

/** Validate a scene coming from the client before it is stored. */
export function parseIncomingScene(value: unknown): ParsedScene {
  if (!isWhiteboardScene(value)) {
    return { ok: false, error: "Некоректний формат дошки." };
  }
  if (sceneByteLength(value) > MAX_SCENE_BYTES) {
    return { ok: false, error: "Дошка завелика для збереження." };
  }
  return { ok: true, scene: value };
}
