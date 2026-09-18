import { describe, expect, it } from "vitest";

import {
  DISCIPLINE_KEY_RE,
  pickPrimaryDiscipline,
  resolveLessonDisciplineKey,
  slugifyDisciplineKey,
} from "@/lib/discipline";

describe("slugifyDisciplineKey", () => {
  it("lowercases and hyphenates ASCII labels", () => {
    expect(slugifyDisciplineKey("English Grammar")).toBe("english-grammar");
  });

  it("transliterates Cyrillic labels into a Latin slug", () => {
    expect(slugifyDisciplineKey("Математика")).toBe("matematyka");
    expect(slugifyDisciplineKey("Англійська мова")).toMatch(
      DISCIPLINE_KEY_RE,
    );
  });

  it("trims leading/trailing separators and collapses repeats", () => {
    expect(slugifyDisciplineKey("  -- Math & Physics!! -- ")).toBe(
      "math-physics",
    );
  });

  it("produces a key that always matches DISCIPLINE_KEY_RE (or is empty)", () => {
    for (const label of ["Math", "Українська мова", "C++", "", "   "]) {
      const key = slugifyDisciplineKey(label);
      if (key) expect(key).toMatch(DISCIPLINE_KEY_RE);
    }
  });
});

describe("pickPrimaryDiscipline", () => {
  it("returns the one marked primary", () => {
    const disciplines = [
      { key: "math", isPrimary: false },
      { key: "english", isPrimary: true },
    ];
    expect(pickPrimaryDiscipline(disciplines)?.key).toBe("english");
  });

  it("falls back to the first when none is marked primary", () => {
    const disciplines = [
      { key: "math", isPrimary: false },
      { key: "english", isPrimary: false },
    ];
    expect(pickPrimaryDiscipline(disciplines)?.key).toBe("math");
  });

  it("returns null for an empty list", () => {
    expect(pickPrimaryDiscipline([])).toBeNull();
  });
});

describe("resolveLessonDisciplineKey", () => {
  const teacherDisciplines = [
    { key: "math", isPrimary: true },
    { key: "english", isPrimary: false },
  ];

  it("prefers the lesson's own explicit key", () => {
    expect(
      resolveLessonDisciplineKey(
        { disciplineKey: "english" },
        teacherDisciplines,
      ),
    ).toBe("english");
  });

  it("inherits the teacher's primary discipline when unset", () => {
    expect(
      resolveLessonDisciplineKey({ disciplineKey: null }, teacherDisciplines),
    ).toBe("math");
  });

  it("returns null when the teacher has configured no disciplines — math-only teachers keep working unchanged", () => {
    expect(resolveLessonDisciplineKey({ disciplineKey: null }, [])).toBeNull();
  });
});
