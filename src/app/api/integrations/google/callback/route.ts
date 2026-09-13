import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { googleOAuthConfig } from "@/server/integrations/google/config";
import {
  exchangeCode,
  fetchUserInfo,
  OAUTH_STATE_COOKIE,
} from "@/server/integrations/google/oauth";
import { connectGoogleIntegration } from "@/server/integrations/google/client";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

/** OAuth redirect target: exchange the code, store tokens, back to settings. */
export async function GET(request: Request) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  const settingsUrl = new URL("/teacher/settings", env.APP_URL);
  const config = googleOAuthConfig();
  if (!config) {
    settingsUrl.searchParams.set("google", "disabled");
    return NextResponse.redirect(settingsUrl);
  }

  const params = new URL(request.url).searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const oauthError = params.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (
    oauthError ||
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState
  ) {
    settingsUrl.searchParams.set("google", "error");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const token = await exchangeCode(config, code);
    const userInfo = await fetchUserInfo(token.access_token);
    await connectGoogleIntegration({ teacherId, token, userInfo });
    settingsUrl.searchParams.set("google", "connected");
  } catch {
    settingsUrl.searchParams.set("google", "error");
  }

  return NextResponse.redirect(settingsUrl);
}
