import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque tokens for invitation / verification links.
 *
 * The raw token is shown to the user exactly once (in the link). Only its
 * SHA-256 hash is stored, so a DB leak does not hand out working links.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
