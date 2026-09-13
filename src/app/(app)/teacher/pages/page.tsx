import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { listTeacherPages } from "@/server/pages/pages";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonClass } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";

import { createPageAction } from "./actions";

export const metadata: Metadata = { title: "Сторінки" };

export default async function TeacherPagesPage() {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const pages = await listTeacherPages(teacherId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Сторінки"
        actions={
          <form action={createPageAction}>
            <button type="submit" className={buttonClass("primary", "md")}>
              Створити сторінку
            </button>
          </form>
        }
      />

      {pages.length === 0 ? (
        <EmptyState
          icon={<Icon name="file" className="size-5" />}
          title="Ще немає жодної сторінки"
          description="Сторінки — це конспекти уроку. Створіть першу й прикріпіть до уроку."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {pages.map((page) => (
            <li key={page.id}>
              <Link href={`/teacher/pages/${page.id}`} className="block">
                <Card className="hover:bg-surface-2 flex flex-col gap-1 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <span className="text-sm font-medium">{page.title}</span>
                  <span className="text-muted text-xs">
                    {page.lesson ? `Урок: ${page.lesson.subject}` : "Без уроку"}{" "}
                    · {page.updatedAt.toLocaleDateString("uk-UA")}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
