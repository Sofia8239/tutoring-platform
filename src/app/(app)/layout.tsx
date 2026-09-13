import Link from "next/link";
import type { ReactNode } from "react";

import { requireUser } from "@/lib/session";
import { homePathForRole } from "@/lib/route-access";
import { unreadNotificationCount } from "@/server/notifications/inbox";
import { UserRole } from "@/generated/prisma/enums";

import {
  BottomNav,
  MobileTopActions,
  SidebarNav,
  type NavItem,
} from "./app-nav";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Викладач",
  STUDENT: "Учень",
  ADMIN: "Адміністратор",
};

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  [UserRole.TEACHER]: [
    { href: "/teacher", label: "Кабінет", icon: "home" },
    { href: "/teacher/lessons", label: "Уроки", icon: "calendar" },
    { href: "/teacher/pages", label: "Сторінки", icon: "file" },
    { href: "/teacher/stats", label: "Статистика", icon: "chart" },
    { href: "/teacher/settings", label: "Налаштування", icon: "settings" },
  ],
  [UserRole.STUDENT]: [
    { href: "/student", label: "Кабінет", icon: "home" },
    { href: "/student/lessons", label: "Уроки", icon: "calendar" },
  ],
  [UserRole.ADMIN]: [{ href: "/teacher", label: "Кабінет", icon: "home" }],
};

const NOTIFICATIONS: NavItem = {
  href: "/notifications",
  label: "Сповіщення",
  icon: "bell",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const unread = await unreadNotificationCount(user.id);
  const roleNav = NAV_BY_ROLE[user.role] ?? [];
  const sidebarItems = [...roleNav, NOTIFICATIONS];
  // Mobile bottom bar: role tabs only; bell + gear live in the top bar.
  const bottomItems = roleNav.filter((i) => i.icon !== "settings");
  const topExtras: NavItem[] = [
    NOTIFICATIONS,
    ...roleNav.filter((i) => i.icon === "settings"),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="border-line bg-surface sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-4 py-5 md:flex">
        <Link
          href={homePathForRole(user.role)}
          className="text-primary px-3 text-base font-semibold tracking-tight"
        >
          Tutoring Platform
        </Link>
        <div className="mt-6 flex-1">
          <SidebarNav items={sidebarItems} unread={unread} />
        </div>
        <div className="border-line flex flex-col gap-2 border-t pt-4">
          <p className="text-muted px-3 text-xs">
            {user.name ?? user.email}
            <br />
            {ROLE_LABEL[user.role] ?? user.role}
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="border-line bg-surface/95 sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
        <Link
          href={homePathForRole(user.role)}
          className="text-primary text-sm font-semibold tracking-tight"
        >
          Tutoring Platform
        </Link>
        <MobileTopActions extras={topExtras} unread={unread} />
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 pb-24 sm:px-6 md:py-10 md:pb-10">
        {children}
      </main>

      <BottomNav items={bottomItems} />
    </div>
  );
}
