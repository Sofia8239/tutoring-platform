import { redirect } from "next/navigation";

import { requireUser } from "@/lib/session";
import { homePathForRole } from "@/lib/route-access";

/** Role-neutral entry point. Auth.js redirects here after sign-in. */
export default async function DashboardPage() {
  const user = await requireUser();
  redirect(homePathForRole(user.role));
}
