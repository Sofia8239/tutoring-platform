import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вхід" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Вхід</h1>
        <p className="text-muted text-sm">
          Увійдіть у свій кабінет репетитора або учня.
        </p>
      </div>
      <LoginForm callbackUrl={callbackUrl ?? "/dashboard"} />
      <p className="text-muted text-sm">
        Ви репетитор і ще не маєте акаунта?{" "}
        <Link href="/register" className="underline">
          Зареєструватися
        </Link>
      </p>
    </div>
  );
}
