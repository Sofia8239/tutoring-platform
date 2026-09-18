import { describe, expect, it } from "vitest";

import { extractJsonText } from "@/lib/json-extract";

describe("extractJsonText", () => {
  it("passes clean JSON through unchanged", () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it("strips a ```json fence", () => {
    const raw = '```json\n{"a":1}\n```';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1 });
  });

  it("strips a bare ``` fence with no language tag", () => {
    const raw = '```\n{"a":1}\n```';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1 });
  });

  it("drops leading prose before the JSON", () => {
    const raw = 'Ось результат:\n{"a":1}';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1 });
  });

  it("drops trailing prose after the JSON", () => {
    const raw = '{"a":1}\nСподіваюсь, це допомогло!';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1 });
  });

  it("drops prose on both sides at once", () => {
    const raw = 'Ось JSON:\n```json\n{"a":1,"b":[1,2,3]}\n```\nГотово.';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("handles a top-level array", () => {
    const raw = 'Тут масив: [{"a":1},{"a":2}] от і все';
    expect(JSON.parse(extractJsonText(raw))).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("preserves nested braces inside the JSON", () => {
    const raw = '{"a":{"b":{"c":1}}}';
    expect(JSON.parse(extractJsonText(raw))).toEqual({ a: { b: { c: 1 } } });
  });

  it("returns the original text unchanged when there is no JSON-like content", () => {
    expect(extractJsonText("не сьогодні")).toBe("не сьогодні");
  });
});
