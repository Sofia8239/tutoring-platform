import { Resend } from "resend";

import { env } from "@/lib/env";

/**
 * Email via Resend. Feature-flagged: without `RESEND_API_KEY` every send is a
 * no-op that logs, so reminders still work end-to-end in dev.
 */

export function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

let client: Resend | null = null;

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean }> {
  if (!env.RESEND_API_KEY) {
    console.log(
      `[email:noop] to=${input.to} subject=${JSON.stringify(input.subject)}`,
    );
    return { ok: true };
  }

  if (!client) client = new Resend(env.RESEND_API_KEY);

  try {
    const result = await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    if (result.error) {
      console.error(`[email:error] ${result.error.message}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error(
      `[email:error] ${error instanceof Error ? error.message : String(error)}`,
    );
    return { ok: false };
  }
}
