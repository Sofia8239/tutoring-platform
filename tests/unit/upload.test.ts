import { describe, expect, it } from "vitest";

import {
  buildSubmissionKey,
  isImageType,
  MAX_UPLOAD_BYTES,
  sanitizeFilename,
  validateUpload,
} from "@/lib/upload";

describe("validateUpload", () => {
  it("accepts allowed types under the size cap", () => {
    expect(validateUpload({ contentType: "image/png", size: 1000 })).toEqual({
      ok: true,
      ext: "png",
    });
    expect(
      validateUpload({ contentType: "application/pdf", size: 1000 }).ok,
    ).toBe(true);
  });

  it("rejects disallowed types", () => {
    expect(validateUpload({ contentType: "image/gif", size: 100 }).ok).toBe(
      false,
    );
    expect(validateUpload({ contentType: "text/plain", size: 100 }).ok).toBe(
      false,
    );
  });

  it("rejects empty and oversized files", () => {
    expect(validateUpload({ contentType: "image/png", size: 0 }).ok).toBe(
      false,
    );
    expect(
      validateUpload({ contentType: "image/png", size: MAX_UPLOAD_BYTES + 1 })
        .ok,
    ).toBe(false);
  });
});

describe("sanitizeFilename", () => {
  it("strips paths and unsafe characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("a b c.png")).toBe("a_b_c.png");
    expect(sanitizeFilename("hw!@#.pdf")).toBe("hw_.pdf");
    expect(sanitizeFilename("")).toBe("file");
  });
});

describe("buildSubmissionKey", () => {
  it("nests under the teacher id with a uuid segment", () => {
    const key = buildSubmissionKey({ teacherId: "t1", filename: "hw.png" });
    expect(key).toMatch(/^submissions\/t1\/[0-9a-f-]{36}\/hw\.png$/);
  });
});

describe("isImageType", () => {
  it("is true only for jpeg/png/webp", () => {
    expect(isImageType("image/jpeg")).toBe(true);
    expect(isImageType("image/webp")).toBe(true);
    expect(isImageType("application/pdf")).toBe(false);
    expect(isImageType(null)).toBe(false);
  });
});
