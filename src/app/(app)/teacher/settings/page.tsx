import type { Metadata } from "next";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { formatInZone } from "@/lib/datetime";
import { getTeacherProfile } from "@/server/users/users";
import { isGoogleCalendarConfigured } from "@/server/integrations/google/config";
import { getGoogleIntegrationSummary } from "@/server/integrations/google/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";

import { MeetingUrlForm } from "./settings-form";
import { disconnectGoogleAction } from "./actions";

export const metadata: Metadata = { title: "Налаштування" };

const GOOGLE_BANNER: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google Календар підключено." },
  error: {
    ok: false,
    text: "Не вдалося підключити Google Календар. Спробуйте ще раз.",
  },
  disabled: {
    ok: false,
    text: "Інтеграцію з Google не налаштовано на сервері.",
  },
};

export default async function TeacherSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { google } = await searchParams;

  const profile = await getTeacherProfile(teacherId);
  const googleConfigured = isGoogleCalendarConfigured();
  const googleIntegration = googleConfigured
    ? await getGoogleIntegrationSummary(teacherId)
    : null;
  const banner = google ? GOOGLE_BANNER[google] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Налаштування" />

      <Card className="flex flex-col gap-3">
        <CardTitle>Відеозустрічі</CardTitle>
        <MeetingUrlForm initialValue={profile.defaultMeetingUrl ?? ""} />
      </Card>

      {googleConfigured ? (
        <Card className="flex flex-col gap-3">
          <CardTitle>Google Календар</CardTitle>

          {banner ? (
            <p
              className={
                banner.ok ? "text-success text-sm" : "text-danger text-sm"
              }
            >
              {banner.text}
            </p>
          ) : null}

          {googleIntegration ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Підключено{" "}
                {googleIntegration.email ? (
                  <span className="font-medium">{googleIntegration.email}</span>
                ) : null}{" "}
                <span className="text-muted">
                  (
                  {formatInZone(
                    googleIntegration.connectedAt,
                    profile.timezone,
                  )}
                  )
                </span>
              </p>
              <p className="text-muted">
                Уроки автоматично зʼявляються у вашому календарі; скасовані —
                видаляються.
              </p>
              <form action={disconnectGoogleAction}>
                <button
                  type="submit"
                  className={buttonClass("secondary", "sm", "w-fit")}
                >
                  Відключити
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">
                Підключіть календар, щоб уроки автоматично потрапляли у Google
                Calendar.
              </p>
              <a
                href="/api/integrations/google/connect"
                className={buttonClass("primary", "md", "w-fit")}
              >
                Підключити Google Календар
              </a>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
