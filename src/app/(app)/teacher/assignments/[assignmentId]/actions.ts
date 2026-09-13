"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { AiError } from "@/server/ai/provider";
import {
  AssignmentEditError,
  refineAssignmentWithAi,
  updateAssignmentContent,
  type AssignmentContent,
  type UpdateAssignmentInput,
} from "@/server/lessons/assignment-edit";
import { UserRole } from "@/generated/prisma/enums";

export type AssignmentEditResult =
  { ok: true; content: AssignmentContent } | { ok: false; error: string };

export async function updateAssignmentAction(input: {
  assignmentId: string;
  patch: UpdateAssignmentInput;
}): Promise<AssignmentEditResult> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  try {
    const content = await updateAssignmentContent(
      teacherId,
      input.assignmentId,
      input.patch,
    );
    revalidatePath(`/teacher/assignments/${input.assignmentId}`);
    return { ok: true, content };
  } catch (error) {
    if (error instanceof AssignmentEditError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function refineAssignmentAction(input: {
  assignmentId: string;
  instruction: string;
}): Promise<AssignmentEditResult> {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);

  try {
    const content = await refineAssignmentWithAi(
      teacherId,
      input.assignmentId,
      input.instruction,
    );
    revalidatePath(`/teacher/assignments/${input.assignmentId}`);
    return { ok: true, content };
  } catch (error) {
    if (error instanceof AssignmentEditError || error instanceof AiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}
