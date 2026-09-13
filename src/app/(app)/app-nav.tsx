"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";

export type NavItem = { href: string; label: string; icon: IconName };

function isActive(pathname: string, href: string): boolean {
  if (href === "/teacher" || href === "/student") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop: vertical sidebar list. */
export function SidebarNav({
  items,
  unread,
}: {
  items: NavItem[];
  unread: number;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-btn flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-primary text-primary-ink"
                : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon name={item.icon} className="size-5" />
            <span className="flex-1">{item.label}</span>
            {item.href === "/notifications" && unread > 0 ? (
              <span className="bg-danger grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold text-white">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: fixed bottom tab bar. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-20 flex border-t backdrop-blur md:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <span
              className={`rounded-chip grid place-items-center px-4 py-1 transition-colors ${
                active ? "bg-primary text-primary-ink" : ""
              }`}
            >
              <Icon name={item.icon} className="size-5" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTopActions({
  extras,
  unread,
}: {
  extras: NavItem[];
  unread: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {extras.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-label={item.label}
          className="rounded-btn text-muted hover:bg-surface-2 hover:text-ink relative grid size-9 place-items-center"
        >
          <Icon name={item.icon} className="size-5" />
          {item.href === "/notifications" && unread > 0 ? (
            <span className="bg-danger absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-0.5 text-[10px] font-semibold text-white">
              {unread}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function NavShell({ children }: { children: ReactNode }) {
  return children;
}
