import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { docOrEmpty } from "@/lib/tiptap-doc";
import { getPageForTeacher } from "@/server/pages/pages";
import { listLessonsForTeacher } from "@/server/lessons/lessons";
import { isAiConfigured } from "@/server/ai/generate-tasks";
import { PageEditor } from "@/components/pages/page-editor";
import { buttonClass } from "@/components/ui/button";
import { UserRole } from "@/generated/prisma/enums";

import { deletePageAction, updatePageAction } from "../actions";

export const metadata: Metadata = { title: "Сторінка" };

export default async function TeacherPageEditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { pageId } = await params;

  const [page, lessons] = await Promise.all([
    getPageForTeacher(teacherId, pageId),
    listLessonsForTeacher(teacherId, { scope: "all" }),
  ]);
  if (!page) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link
          href="/teacher/pages"
          className="text-muted hover:text-ink text-sm"
        >
          ← До сторінок
        </Link>
        <div className="flex items-center gap-2">
          {isAiConfigured() ? (
            <Link
              href={`/teacher/pages/${page.id}/generate`}
              className={buttonClass("secondary", "sm")}
            >
              AI-завдання
            </Link>
          ) : null}
          <a
            href={`/teacher/pages/${page.id}/pdf`}
            className={buttonClass("secondary", "sm")}
          >
            Завантажити PDF
          </a>
          <form action={deletePageAction}>
            <input type="hidden" name="pageId" value={page.id} />
            <button type="submit" className={buttonClass("danger", "sm")}>
              Видалити
            </button>
          </form>
        </div>
      </div>

      <PageEditor
        pageId={page.id}
        initialTitle={page.title}
        initialContent={docOrEmpty(page.contentJson)}
        initialLessonId={page.lessonId}
        lessons={lessons.map((l) => ({ id: l.id, subject: l.subject }))}
        saveAction={updatePageAction}
      />
    </div>
  );
}
