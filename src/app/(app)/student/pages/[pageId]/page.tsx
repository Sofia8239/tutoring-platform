import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { getPageForStudent } from "@/server/pages/pages";
import { buttonClass } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Сторінка" };

export default async function StudentPageView({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const user = await requireRole(UserRole.STUDENT);
  const { pageId } = await params;

  const page = await getPageForStudent(user.id, pageId);
  if (!page) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/student/lessons"
          className="text-muted hover:text-ink text-sm"
        >
          ← До уроків
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {page.title}
          </h1>
          <a
            href={`/student/pages/${page.id}/pdf`}
            className={buttonClass("secondary", "sm", "shrink-0")}
          >
            PDF
          </a>
        </div>
        <p className="text-muted text-xs">
          Урок: {page.lessonSubject} · оновлено{" "}
          {page.updatedAt.toLocaleDateString("uk-UA")}
        </p>
      </div>

      <article
        className="tiptap-content max-w-none"
        // Content is authored by the teacher and rendered server-side from
        // stored TipTap JSON via @tiptap/static-renderer.
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}
