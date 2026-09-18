import { describe, expect, it } from "vitest";

import { buildLessonMaterialFlags } from "@/lib/lesson-materials";

describe("buildLessonMaterialFlags", () => {
  it("flags each material independently per lesson", () => {
    const flags = buildLessonMaterialFlags(["l1", "l2"], {
      pages: ["l1"],
      assignments: ["l2"],
      boards: ["l1", "l2"],
    });
    expect(flags.get("l1")).toEqual({
      hasNotes: true,
      hasAssignment: false,
      hasBoard: true,
    });
    expect(flags.get("l2")).toEqual({
      hasNotes: false,
      hasAssignment: true,
      hasBoard: true,
    });
  });

  it("returns all-false for a lesson with no materials", () => {
    const flags = buildLessonMaterialFlags(["l1"], {
      pages: [],
      assignments: [],
      boards: [],
    });
    expect(flags.get("l1")).toEqual({
      hasNotes: false,
      hasAssignment: false,
      hasBoard: false,
    });
  });

  it("returns one entry per requested lesson id, ignoring unrelated ids in `present`", () => {
    const flags = buildLessonMaterialFlags(["l1"], {
      pages: ["l1", "other-lesson"],
      assignments: [],
      boards: [],
    });
    expect(flags.size).toBe(1);
    expect(flags.get("l1")?.hasNotes).toBe(true);
  });
});
