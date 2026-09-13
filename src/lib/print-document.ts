/**
 * Build a standalone, self-contained HTML document for PDF rendering. Pure — no
 * DOM, no Puppeteer — so it is unit-testable. The prose rules mirror
 * `.tiptap-content` in `globals.css` but are inlined here because the PDF is
 * rendered from `page.setContent()` with no stylesheet pipeline.
 */

const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #111;
  }
  .doc-title { font-size: 20pt; font-weight: 700; margin: 0 0 4mm; }
  .doc-meta { font-size: 9pt; color: #666; margin: 0 0 8mm; }
  .content > * + * { margin-top: 3mm; }
  .content h1 { font-size: 16pt; font-weight: 700; margin-top: 6mm; }
  .content h2 { font-size: 14pt; font-weight: 700; margin-top: 5mm; }
  .content h3 { font-size: 12pt; font-weight: 700; margin-top: 4mm; }
  .content ul, .content ol { padding-left: 7mm; }
  .content ul { list-style: disc; }
  .content ol { list-style: decimal; }
  .content blockquote {
    border-left: 3px solid #999; padding-left: 4mm; color: #333; margin-left: 0;
  }
  .content pre {
    background: #f3f3f3; padding: 3mm 4mm; border-radius: 2mm;
    white-space: pre-wrap; word-break: break-word; font-size: 10pt;
  }
  .content code { background: #f3f3f3; padding: 0.2mm 1mm; border-radius: 1mm; font-size: 10pt; }
  .content pre code { background: none; padding: 0; }
  .content hr { border: none; border-top: 1px solid #ccc; margin: 5mm 0; }
  .content a { color: #111; text-decoration: underline; }
  .content table { border-collapse: collapse; width: 100%; }
  .content th, .content td { border: 1px solid #999; padding: 1.5mm 2mm; vertical-align: top; }
  .content th { background: #eee; font-weight: 700; }
  .content ul[data-type="taskList"] { list-style: none; padding-left: 1mm; }
  .content ul[data-type="taskList"] li { display: flex; gap: 2mm; align-items: flex-start; }
  .content img { max-width: 100%; }
  .doc-section { break-before: page; }
  .doc-section:first-of-type { break-before: auto; }
  .section-heading { font-size: 15pt; font-weight: 700; margin: 0 0 3mm; }
  .board-image { display: block; max-width: 100%; margin: 0 auto; }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPrintDocument(input: {
  title: string;
  bodyHtml: string;
  meta?: string;
}): string {
  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<h1 class="doc-title">${escapeHtml(input.title)}</h1>
${input.meta ? `<p class="doc-meta">${escapeHtml(input.meta)}</p>` : ""}
<div class="content">${input.bodyHtml}</div>
</body>
</html>`;
}

export type PrintSection = {
  heading: string;
  /** Already-rendered, trusted HTML (TipTap render output or a `<img>` tag). */
  bodyHtml: string;
  meta?: string;
};

/**
 * One PDF holding several sections (a lesson's pages, plus optionally the
 * whiteboard image). Each section after the first starts on a new page.
 */
export function buildCombinedPrintDocument(input: {
  title: string;
  meta?: string;
  sections: PrintSection[];
}): string {
  const sections = input.sections
    .map(
      (s) => `<section class="doc-section">
<h2 class="section-heading">${escapeHtml(s.heading)}</h2>
${s.meta ? `<p class="doc-meta">${escapeHtml(s.meta)}</p>` : ""}
<div class="content">${s.bodyHtml}</div>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="uk">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<h1 class="doc-title">${escapeHtml(input.title)}</h1>
${input.meta ? `<p class="doc-meta">${escapeHtml(input.meta)}</p>` : ""}
${sections}
</body>
</html>`;
}

/** RFC 5987 filename for `Content-Disposition` (ascii fallback + UTF-8). */
export function contentDispositionAttachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
