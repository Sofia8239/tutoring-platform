import "server-only";

import { prisma } from "@/lib/prisma";
import { googleOAuthConfig } from "@/server/integrations/google/config";
import { accessTokenExpired } from "@/server/integrations/google/token";
import {
  GoogleAuthRevokedError,
  refreshAccessToken,
  revokeToken,
  type GoogleTokenResponse,
  type GoogleUserInfo,
} from "@/server/integrations/google/oauth";

/**
 * Stateful Google layer: the per-teacher `GoogleIntegration` row plus access
 * token refresh. `client.ts` is the only Google module that touches Prisma.
 *
 * TODO(security): `accessToken` / `refreshToken` are stored in plaintext. Move
 * to encryption-at-rest (libsodium sealed box with a key from env) before this
 * is multi-tenant.
 */

function expiryFromResponse(token: GoogleTokenResponse): Date {
  return new Date(Date.now() + token.expires_in * 1000);
}

export type GoogleIntegrationSummary = {
  email: string | null;
  calendarId: string;
  scope: string;
  connectedAt: Date;
};

export async function getGoogleIntegrationSummary(
  teacherId: string,
): Promise<GoogleIntegrationSummary | null> {
  const row = await prisma.googleIntegration.findUnique({
    where: { userId: teacherId },
    select: { email: true, calendarId: true, scope: true, createdAt: true },
  });
  return row
    ? {
        email: row.email,
        calendarId: row.calendarId,
        scope: row.scope,
        connectedAt: row.createdAt,
      }
    : null;
}

export async function connectGoogleIntegration(input: {
  teacherId: string;
  token: GoogleTokenResponse;
  userInfo: GoogleUserInfo;
}): Promise<void> {
  const { teacherId, token, userInfo } = input;
  const expiryDate = expiryFromResponse(token);

  const existing = await prisma.googleIntegration.findUnique({
    where: { userId: teacherId },
    select: { refreshToken: true },
  });

  // Google only returns a refresh_token on first consent; keep the old one if a
  // re-consent omits it.
  const refreshToken = token.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new GoogleAuthRevokedError(
      "Google did not return a refresh token; re-consent with prompt=consent",
    );
  }

  const data = {
    googleUserId: userInfo.sub || null,
    email: userInfo.email,
    accessToken: token.access_token,
    refreshToken,
    scope: token.scope,
    tokenType: token.token_type || "Bearer",
    expiryDate,
  };

  await prisma.googleIntegration.upsert({
    where: { userId: teacherId },
    create: { userId: teacherId, ...data },
    update: data,
  });
}

export async function disconnectGoogleIntegration(
  teacherId: string,
): Promise<void> {
  const row = await prisma.googleIntegration.findUnique({
    where: { userId: teacherId },
    select: { refreshToken: true },
  });
  if (!row) return;

  await revokeToken(row.refreshToken);
  await prisma.googleIntegration.delete({ where: { userId: teacherId } });
}

export type FreshToken = { accessToken: string; calendarId: string };

/**
 * Return a currently-valid access token for the teacher, refreshing and
 * persisting if needed. `null` when the teacher has not connected Google.
 * Throws {@link GoogleAuthRevokedError} (after deleting the dead row) when the
 * refresh token has been revoked.
 */
export async function getFreshAccessToken(
  teacherId: string,
): Promise<FreshToken | null> {
  const config = googleOAuthConfig();
  if (!config) return null;

  const row = await prisma.googleIntegration.findUnique({
    where: { userId: teacherId },
  });
  if (!row) return null;

  if (!accessTokenExpired(row.expiryDate)) {
    return { accessToken: row.accessToken, calendarId: row.calendarId };
  }

  try {
    const refreshed = await refreshAccessToken(config, row.refreshToken);
    await prisma.googleIntegration.update({
      where: { userId: teacherId },
      data: {
        accessToken: refreshed.access_token,
        expiryDate: expiryFromResponse(refreshed),
        ...(refreshed.refresh_token
          ? { refreshToken: refreshed.refresh_token }
          : {}),
        ...(refreshed.scope ? { scope: refreshed.scope } : {}),
      },
    });
    return { accessToken: refreshed.access_token, calendarId: row.calendarId };
  } catch (error) {
    if (error instanceof GoogleAuthRevokedError) {
      await prisma.googleIntegration
        .delete({ where: { userId: teacherId } })
        .catch(() => undefined);
    }
    throw error;
  }
}
