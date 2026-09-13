import { describe, expect, it } from "vitest";

import {
  displayEmail,
  isPlaceholderEmail,
  placeholderEmail,
} from "@/lib/manual-student";

describe("manual-student email helpers", () => {
  it("mints unique placeholder addresses on the reserved domain", () => {
    const a = placeholderEmail();
    const b = placeholderEmail();
    expect(a).not.toBe(b);
    expect(a.endsWith("@no-login.tutoring.local")).toBe(true);
    expect(isPlaceholderEmail(a)).toBe(true);
  });

  it("treats real addresses as real", () => {
    expect(isPlaceholderEmail("anna@example.com")).toBe(false);
    expect(isPlaceholderEmail("")).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
  });

  it("hides placeholders from the UI but shows real emails", () => {
    expect(displayEmail(placeholderEmail())).toBe("");
    expect(displayEmail("anna@example.com")).toBe("anna@example.com");
    expect(displayEmail(null)).toBe("");
  });
});
