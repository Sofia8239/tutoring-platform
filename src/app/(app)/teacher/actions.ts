"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { env } from "@/lib/env";
import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { createInvitation } from "@/server/auth/invitations";
import { createManualStudent, StudentError } from "@/server/users/users";
import { UserRole } from "@/generated/prisma/enums";

export type InviteState = {
  ok: boolean;
  message: string | null;
  link: string | null;
};

const schema = z.object({ email: z.string().email("Некоректний email.") });

export async function inviteStudentAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await requireRole(UserRole.TEACHER);

  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Некоректні дані.",
      link: null,
    };
  }

  const teacherId = resolveTenantId(user);
  const { rawToken, expiresAt } = await createInvitation({
    teacherId,
    createdById: user.id,
    email: parsed.data.email,
    role: UserRole.STUDENT,
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");

  return {
    ok: true,
    message: `Запрошення створено. Діє до ${expiresAt.toLocaleDateString("uk-UA")}.`,
    link: `${env.APP_URL}/join/${rawToken}`,
  };
}

export type AddStudentState = { ok: boolean; message: string | null };

const manualSchema = z.object({
  name: z.string().trim().min(2, "Вкажіть імʼя учня.").max(120),
  email: z.string().trim().optional(),
});

export async function addManualStudentAction(
  _prev: AddStudentState,
  formData: FormData,
): Promise<AddStudentState> {
  const user = await requireRole(UserRole.TEACHER);

  const parsed = manualSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Некоректні дані.",
    };
  }

  try {
    await createManualStudent(resolveTenantId(user), {
      name: parsed.data.name,
      email: parsed.data.email || null,
    });
  } catch (error) {
    if (error instanceof StudentError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  return { ok: true, message: "Учня додано." };
}
