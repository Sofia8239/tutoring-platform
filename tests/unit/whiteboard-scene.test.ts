import { describe, expect, it } from "vitest";

import {
  isWhiteboardScene,
  MAX_SCENE_BYTES,
  parseIncomingScene,
  roomSnapshotToStoreSnapshot,
  sceneByteLength,
  sceneOrUndefined,
} from "@/lib/whiteboard-scene";

const validScene = {
  schema: { schemaVersion: 2 },
  store: { "shape:abc": { id: "shape:abc", type: "geo" } },
};

describe("isWhiteboardScene", () => {
  it("accepts a document snapshot with a store map", () => {
    expect(isWhiteboardScene(validScene)).toBe(true);
  });

  it("rejects the empty-default and other shapes", () => {
    expect(isWhiteboardScene({})).toBe(false);
    expect(isWhiteboardScene(null)).toBe(false);
    expect(isWhiteboardScene({ store: "nope" })).toBe(false);
    expect(isWhiteboardScene([])).toBe(false);
  });
});

describe("sceneOrUndefined", () => {
  it("passes a real scene through and maps junk to undefined", () => {
    expect(sceneOrUndefined(validScene)).toBe(validScene);
    expect(sceneOrUndefined({})).toBeUndefined();
    expect(sceneOrUndefined(null)).toBeUndefined();
  });
});

describe("parseIncomingScene", () => {
  it("accepts a valid scene", () => {
    expect(parseIncomingScene(validScene)).toEqual({
      ok: true,
      scene: validScene,
    });
  });

  it("rejects a non-scene value", () => {
    const result = parseIncomingScene({ foo: "bar" });
    expect(result.ok).toBe(false);
  });

  it("rejects a scene over the byte cap", () => {
    const huge = {
      schema: {},
      store: { big: { blob: "x".repeat(MAX_SCENE_BYTES + 10) } },
    };
    expect(sceneByteLength(huge)).toBeGreaterThan(MAX_SCENE_BYTES);
    const result = parseIncomingScene(huge);
    expect(result.ok).toBe(false);
  });
});

describe("roomSnapshotToStoreSnapshot", () => {
  it("turns the sync room's documents array into an id -> record map", () => {
    const converted = roomSnapshotToStoreSnapshot({
      schema: { schemaVersion: 2 },
      documents: [
        { state: { id: "shape:a", typeName: "shape" } },
        { state: { id: "shape:b", typeName: "shape" } },
      ],
    });
    expect(isWhiteboardScene(converted)).toBe(true);
    expect(converted.store).toEqual({
      "shape:a": { id: "shape:a", typeName: "shape" },
      "shape:b": { id: "shape:b", typeName: "shape" },
    });
  });

  it("skips records missing a string id and defaults a missing schema", () => {
    const converted = roomSnapshotToStoreSnapshot({
      documents: [
        { state: { id: "shape:a" } },
        { state: {} },
        { state: { id: 42 } },
      ],
    });
    expect(Object.keys(converted.store)).toEqual(["shape:a"]);
    expect(converted.schema).toBeNull();
  });
});
