import { describe, expect, it } from "vitest";

import { resolveGoogleConfig } from "@/server/integrations/google/config";
import { buildConsentUrl } from "@/server/integrations/google/oauth";
import { buildLessonEvent } from "@/server/integrations/google/event";
import { accessTokenExpired } from "@/server/integrations/google/token";
import { LessonStatus } from "@/generated/prisma/enums";

describe("resolveGoogleConfig", () => {
  const base = { APP_URL: "https://app.example.com" };

  it("is null without a client id or secret", () => {
    expect(resolveGoogleConfig(base)).toBeNull();
    expect(resolveGoogleConfig({ ...base, GOOGLE_CLIENT_ID: "id" })).toBeNull();
  });

  it("derives the redirect URI from APP_URL", () => {
    const config = resolveGoogleConfig({
      ...base,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(config).toEqual({
      clientId: "id",
      clientSecret: "secret",
      redirectUri: "https://app.example.com/api/integrations/google/callback",
    });
  });

  it("honours an explicit redirect URI", () => {
    const config = resolveGoogleConfig({
      APP_URL: "https://app.example.com/",
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
      GOOGLE_OAUTH_REDIRECT_URI: "https://proxy.example.com/cb",
    });
    expect(config?.redirectUri).toBe("https://proxy.example.com/cb");
  });
});

describe("buildConsentUrl", () => {
  const config = {
    clientId: "cid",
    clientSecret: "csecret",
    redirectUri: "https://app.example.com/cb",
  };

  it("requests offline access and forces consent", () => {
    const url = new URL(buildConsentUrl(config, "state-123"));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/cb",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
  });
});

describe("buildLessonEvent", () => {
  const base = {
    subject: "Математика",
    studentName: "Анна",
    studentEmail: "anna@example.com",
    scheduledStart: new Date("2026-09-15T14:00:00Z"),
    scheduledEnd: new Date("2026-09-15T15:00:00Z"),
    status: LessonStatus.SCHEDULED,
    meetLink: "https://zoom.us/j/123",
    notes: "Взяти зошит",
    timezone: "Europe/Kyiv",
  };

  it("builds summary, times and location", () => {
    const event = buildLessonEvent(base);
    expect(event.summary).toBe("Математика — Анна");
    expect(event.start).toEqual({
      dateTime: "2026-09-15T14:00:00.000Z",
      timeZone: "Europe/Kyiv",
    });
    expect(event.end.dateTime).toBe("2026-09-15T15:00:00.000Z");
    expect(event.location).toBe("https://zoom.us/j/123");
    expect(event.status).toBe("confirmed");
  });

  it("joins notes and the meeting link in the description", () => {
    const event = buildLessonEvent(base);
    expect(event.description).toBe(
      "Взяти зошит\n\nПосилання на зустріч: https://zoom.us/j/123",
    );
  });

  it("falls back to the email when there is no name, and omits empty fields", () => {
    const event = buildLessonEvent({
      ...base,
      studentName: null,
      notes: null,
      meetLink: null,
    });
    expect(event.summary).toBe("Математика — anna@example.com");
    expect(event.description).toBeUndefined();
    expect(event.location).toBeUndefined();
  });

  it("marks a cancelled lesson as cancelled", () => {
    const event = buildLessonEvent({
      ...base,
      status: LessonStatus.CANCELLED,
    });
    expect(event.status).toBe("cancelled");
  });
});

describe("accessTokenExpired", () => {
  const now = new Date("2026-09-15T12:00:00Z");

  it("is true once the token is within the skew window", () => {
    expect(
      accessTokenExpired(new Date("2026-09-15T12:00:30Z"), now, 60_000),
    ).toBe(true);
  });

  it("is false while the token is comfortably valid", () => {
    expect(
      accessTokenExpired(new Date("2026-09-15T12:10:00Z"), now, 60_000),
    ).toBe(false);
  });

  it("is true for an already-expired token", () => {
    expect(accessTokenExpired(new Date("2026-09-15T11:00:00Z"), now)).toBe(
      true,
    );
  });
});
