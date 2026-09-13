/**
 * Pure access-token expiry logic — no Prisma, no `server-only` — so it can be
 * unit tested and reused by `client.ts`.
 */

/** Refresh a little before the token actually expires. */
export const TOKEN_EXPIRY_SKEW_MS = 60_000;

export function accessTokenExpired(
  expiryDate: Date,
  now: Date = new Date(),
  skewMs: number = TOKEN_EXPIRY_SKEW_MS,
): boolean {
  return expiryDate.getTime() - skewMs <= now.getTime();
}
