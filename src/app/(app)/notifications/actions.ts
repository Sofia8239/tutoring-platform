"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { markNotificationsRead } from "@/server/notifications/inbox";

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await markNotificationsRead(user.id);
  revalidatePath("/notifications");
}
