import type { Metadata } from "next";

import { requireUser } from "@/lib/session";
import { listNotifications } from "@/server/notifications/inbox";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";

import { markNotificationsReadAction } from "./actions";

export const metadata: Metadata = { title: "Сповіщення" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const hasUnread = items.some((i) => i.readAt === null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Сповіщення"
        actions={
          hasUnread ? (
            <form action={markNotificationsReadAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Позначити всі прочитаними
              </button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Icon name="bell" className="size-5" />}
          title="Сповіщень поки немає"
          description="Тут зʼявлятимуться нагадування про уроки та оплати."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card
                className={`flex flex-col gap-1 p-4 sm:p-4 ${
                  n.readAt === null
                    ? "border-primary-soft bg-primary-soft/30"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <span className="text-muted shrink-0 text-xs">
                    {n.createdAt.toLocaleString("uk-UA")}
                  </span>
                </div>
                {n.body ? <p className="text-muted text-sm">{n.body}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
