import {
  GOOGLE_OAUTH_SCOPES,
  type GoogleOAuthConfig,
} from "@/server/integrations/google/config";

/**
 * Thin `fetch` wrappers around Google's OAuth2 endpoints. No Prisma, no env —
 * every function takes an explicit config so it stays unit-testable.
 */

/** Short-lived cookie holding the OAuth `state` value for CSRF protection. */
export const OAUTH_STATE_COOKIE = "g_oauth_state";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export class GoogleOAuthError extends Error {}
/** The stored refresh token is no longer valid — the user must reconnect. */
export class GoogleAuthRevokedError extends GoogleOAuthError {}

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
};

export function buildConsentUrl(
  config: GoogleOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    // Force a refresh_token even if the user has consented before.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function postForm(
  url: string,
  body: Record<string, string>,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

async function parseTokenResponse(res: Response): Promise<GoogleTokenResponse> {
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  if (!res.ok) {
    const error =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${res.status}`;
    if (error === "invalid_grant") {
      throw new GoogleAuthRevokedError(
        "Google refresh token is no longer valid",
      );
    }
    throw new GoogleOAuthError(`Google token request failed: ${error}`);
  }

  return json as GoogleTokenResponse;
}

export async function exchangeCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const res = await postForm(TOKEN_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code,
  });
  return parseTokenResponse(res);
}

export async function refreshAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const res = await postForm(TOKEN_URL, {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return parseTokenResponse(res);
}

export async function revokeToken(token: string): Promise<void> {
  // Best effort — a failed revoke must not block disconnecting locally.
  try {
    await postForm(REVOKE_URL, { token });
  } catch {
    /* ignore */
  }
}

export type GoogleUserInfo = { sub: string; email: string | null };

export async function fetchUserInfo(
  accessToken: string,
): Promise<GoogleUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new GoogleOAuthError(
      `Google userinfo request failed: HTTP ${res.status}`,
    );
  }
  const json = (await res.json()) as { sub?: string; email?: string };
  return { sub: json.sub ?? "", email: json.email ?? null };
}
