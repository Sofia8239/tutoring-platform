import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import { generateToken } from "@/lib/tokens";
import { googleOAuthConfig } from "@/server/integrations/google/config";
import {
  buildConsentUrl,
  OAUTH_STATE_COOKIE,
} from "@/server/integrations/google/oauth";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** Start the Google Calendar OAuth flow (teacher only). */
export async function GET() {
  await requireRole(UserRole.TEACHER);

  const settingsUrl = new URL("/teacher/settings", env.APP_URL);
  const config = googleOAuthConfig();
  if (!config) {
    settingsUrl.searchParams.set("google", "disabled");
    return NextResponse.redirect(settingsUrl);
  }

  const state = generateToken(16);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildConsentUrl(config, state));
}
