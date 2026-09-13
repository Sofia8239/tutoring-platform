import { randomUUID } from "node:crypto";

/**
 * Pure rules for homework file uploads. What may be uploaded and how object keys
 * are shaped — shared by the presign action and the storage layer.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^A-Za-z0-9._\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return cleaned || "file";
}

export type UploadValidation =
  { ok: true; ext: string } | { ok: false; error: string };

export function validateUpload(input: {
  contentType: string;
  size: number;
}): UploadValidation {
  const ext = ALLOWED_UPLOAD_TYPES[input.contentType];
  if (!ext) {
    return { ok: false, error: "Дозволені лише JPEG, PNG, WEBP або PDF." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "Порожній файл." };
  }
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Файл більший за 10 МБ." };
  }
  return { ok: true, ext };
}

/** `submissions/<teacherId>/<uuid>/<safe filename>` */
export function buildSubmissionKey(input: {
  teacherId: string;
  filename: string;
}): string {
  return `submissions/${input.teacherId}/${randomUUID()}/${sanitizeFilename(
    input.filename,
  )}`;
}

export function isImageType(contentType: string | null | undefined): boolean {
  return (
    contentType === "image/jpeg" ||
    contentType === "image/png" ||
    contentType === "image/webp"
  );
}
