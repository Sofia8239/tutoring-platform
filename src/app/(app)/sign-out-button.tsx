"use client";

import { Icon } from "@/components/ui/icon";

import { signOutAction } from "./actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-btn text-muted hover:bg-surface-2 hover:text-ink flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition-colors"
      >
        <Icon name="logout" className="size-5" />
        Вийти
      </button>
    </form>
  );
}
