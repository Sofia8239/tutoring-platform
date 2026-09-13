/**
 * A "manual" student (added without an invitation, `User.isRegistered = false`)
 * still needs a unique, non-null `email` because the column is `@unique`. When
 * the teacher gives no email we mint a placeholder on a reserved domain that
 * can never receive mail or be logged into. Pure — safe to import anywhere.
 */

const PLACEHOLDER_DOMAIN = "no-login.tutoring.local";

export function placeholderEmail(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
  return `student-${rand}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

/** Email to show in the UI — empty string for a minted placeholder. */
export function displayEmail(email: string | null | undefined): string {
  if (!email || isPlaceholderEmail(email)) return "";
  return email;
}
