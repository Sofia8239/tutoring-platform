"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn } from "@/lib/auth";
import { registerTeacher } from "@/server/auth/registration";

export type RegisterState = { error: string | null };

const schema = z.object({
  name: z.string().trim().min(2, "Вкажіть імʼя (мінімум 2 символи)."),
  email: z.string().trim().email("Некоректний email."),
  password: z.string().min(8, "Пароль має бути не коротшим за 8 символів."),
});

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некоректні дані." };
  }

  const result = await registerTeacher(parsed.data);
  if ("error" in result) {
    return { error: result.error };
  }

  try {
    // Throws NEXT_REDIRECT on success — must propagate.
    await signIn("credentials", {
      email: parsed.data.email.trim().toLowerCase(),
      password: parsed.data.password,
      redirectTo: "/teacher",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Акаунт створено, але не вдалося увійти. Спробуйте /login.",
      };
    }
    throw error;
  }
}
