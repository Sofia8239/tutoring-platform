import Link from "next/link";

import { buttonClass } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="flex flex-col gap-3">
        <span className="text-muted text-xs font-medium tracking-wide uppercase">
          Робочий простір репетитора
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">
          Tutoring&nbsp;Platform
        </h1>
        <p className="text-muted max-w-xl">
          Уроки й розклад, інтерактивна дошка та конспекти, AI-генерація й
          перевірка домашніх, платежі та статистика — усе в одному зручному,
          спокійному кабінеті.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/register" className={buttonClass("primary")}>
          Створити кабінет
        </Link>
        <Link href="/login" className={buttonClass("secondary")}>
          Увійти
        </Link>
      </div>
    </main>
  );
}
