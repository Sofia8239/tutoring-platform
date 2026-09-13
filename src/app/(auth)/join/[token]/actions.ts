"use server";

import { z } from "zod";

import { signIn } from "@/lib/auth";
import {
  acceptInvitation,
  getUsableInvitation,
} from "@/server/auth/invitations";

export type JoinState = { error: string | null };

const schema = z.object({
  name: z.string().trim().min(2, "Вкажіть імʼя (мінімум 2 символи)."),
  password: z.string().min(8, "Пароль має бути не коротшим за 8 символів."),
});

export async function acceptInvitationAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const rawToken = String(formData.get("token") ?? "");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані." };
  }

  const invitation = await getUsableInvitation(rawToken);
  if (!invitation) {
    return { error: "Запрошення недійсне або протерміноване." };
  }

  const result = await acceptInvitation({
    rawToken,
    name: parsed.data.name,
    password: parsed.data.password,
  });
  if ("error" in result) {
    return { error: result.error };
  }

  // Throws NEXT_REDIRECT on success — must propagate.
  await signIn("credentials", {
    email: invitation.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return { error: null };
}
