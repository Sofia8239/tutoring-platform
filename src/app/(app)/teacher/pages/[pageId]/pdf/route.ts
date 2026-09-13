import { NextResponse } from "next/server";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { renderPageHtml } from "@/lib/tiptap-render";
import { contentDispositionAttachment } from "@/lib/print-document";
import { getPageForTeacher } from "@/server/pages/pages";
import { renderPdf } from "@/server/pages/pdf";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ pageId: string }> },
) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { pageId } = await ctx.params;

  const page = await getPageForTeacher(teacherId, pageId);
  if (!page) return new NextResponse("Not found", { status: 404 });

  const bytes = await renderPdf({
    title: page.title,
    bodyHtml: renderPageHtml(page.contentJson),
    meta: `Оновлено ${page.updatedAt.toLocaleDateString("uk-UA")}`,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionAttachment(`${page.title}.pdf`),
      "Cache-Control": "no-store",
    },
  });
}
