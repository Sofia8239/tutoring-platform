import { env } from "@/lib/env";

/**
 * Google Calendar is an optional integration. It is "configured" only when the
 * OAuth client id + secret are present in the environment; everything else
 * (the connect button, event sync) checks this first and no-ops otherwise.
 */

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/** Scopes requested at consent: per-event calendar write + basic identity. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

type GoogleEnvSource = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;
  APP_URL: string;
};

/** Pure resolver — testable without touching the real `env`. */
export function resolveGoogleConfig(
  source: GoogleEnvSource,
): GoogleOAuthConfig | null {
  if (!source.GOOGLE_CLIENT_ID || !source.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: source.GOOGLE_CLIENT_ID,
    clientSecret: source.GOOGLE_CLIENT_SECRET,
    redirectUri:
      source.GOOGLE_OAUTH_REDIRECT_URI ??
      `${source.APP_URL.replace(/\/$/, "")}/api/integrations/google/callback`,
  };
}

export function googleOAuthConfig(): GoogleOAuthConfig | null {
  return resolveGoogleConfig(env);
}

export function isGoogleCalendarConfigured(): boolean {
  return googleOAuthConfig() !== null;
}
