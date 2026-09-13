import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Реєстрація репетитора" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Реєстрація репетитора
        </h1>
        <p className="text-muted text-sm">
          Створіть власний робочий простір. Учнів ви запросите вже всередині —
          посиланням-запрошенням.
        </p>
      </div>

      <RegisterForm />

      <p className="text-muted text-sm">
        Уже маєте акаунт?{" "}
        <Link href="/login" className="underline">
          Увійти
        </Link>
      </p>
    </div>
  );
}
