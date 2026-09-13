import { NextResponse } from "next/server";

import { requireRole } from "@/lib/session";
import { resolveTenantId } from "@/lib/tenant";
import { renderPageHtml } from "@/lib/tiptap-render";
import {
  contentDispositionAttachment,
  type PrintSection,
} from "@/lib/print-document";
import { getLessonPagesForExport } from "@/server/pages/pages";
import { renderCombinedPdf } from "@/server/pages/pdf";
import { UserRole } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const IMAGE_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/;
const MAX_IMAGE_CHARS = 12_000_000; // ~9 MB decoded

function pdfResponse(bytes: Uint8Array, filename: string): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDispositionAttachment(filename),
      "Cache-Control": "no-store",
    },
  });
}

function pageSections(
  pages: { title: string; updatedAt: Date; contentJson: unknown }[],
): PrintSection[] {
  return pages.map((p) => ({
    heading: p.title,
    bodyHtml: renderPageHtml(p.contentJson),
    meta: `Оновлено ${p.updatedAt.toLocaleDateString("uk-UA")}`,
  }));
}

/** GET ?pages=all | ?pages=<id>&pages=<id> — combined PDF of a lesson's pages. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await ctx.params;

  const raw = new URL(request.url).searchParams.getAll("pages");
  const wantsAll = raw.length === 0 || raw.includes("all");
  const pageIds = wantsAll ? undefined : raw;

  const { lessonSubject, pages } = await getLessonPagesForExport(
    teacherId,
    lessonId,
    pageIds,
  );
  if (!lessonSubject) return new NextResponse("Not found", { status: 404 });
  if (pages.length === 0) {
    return new NextResponse("Немає сторінок для експорту", { status: 404 });
  }

  const bytes = await renderCombinedPdf({
    title: `Матеріали уроку — ${lessonSubject}`,
    meta: `${pages.length} ${pages.length === 1 ? "сторінка" : "сторінок"}`,
    sections: pageSections(pages),
  });

  return pdfResponse(bytes, `Матеріали — ${lessonSubject}.pdf`);
}

/** POST { image?, pages? } — PDF of the whiteboard image, optionally with pages. */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ lessonId: string }> },
) {
  const user = await requireRole(UserRole.TEACHER);
  const teacherId = resolveTenantId(user);
  const { lessonId } = await ctx.params;

  let body: { image?: unknown; pages?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const image = typeof body.image === "string" ? body.image.trim() : "";
  if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) {
    return new NextResponse("Некоректне зображення", { status: 400 });
  }
  const pageIds = Array.isArray(body.pages)
    ? body.pages.filter((v): v is string => typeof v === "string")
    : [];

  const { lessonSubject, pages } = await getLessonPagesForExport(
    teacherId,
    lessonId,
    pageIds.length > 0 ? pageIds : ["__none__"],
  );
  if (!lessonSubject) return new NextResponse("Not found", { status: 404 });

  const sections: PrintSection[] = [
    ...pageSections(pages),
    ...(image
      ? [
          {
            heading: "Дошка",
            bodyHtml: `<img class="board-image" src="${image}" alt="Дошка">`,
          },
        ]
      : []),
  ];
  if (sections.length === 0) {
    return new NextResponse("Нема чого експортувати", { status: 400 });
  }

  const bytes = await renderCombinedPdf({
    title: `Дошка — ${lessonSubject}`,
    sections,
  });

  return pdfResponse(bytes, `Дошка — ${lessonSubject}.pdf`);
}
