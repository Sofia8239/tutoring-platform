import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-14">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-muted hover:text-ink mb-6 block text-sm font-medium transition-colors"
        >
          ← Tutoring Platform
        </Link>
        <div className="rounded-card border-line bg-surface shadow-card border p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
