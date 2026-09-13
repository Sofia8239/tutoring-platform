import { describe, expect, it } from "vitest";

import {
  buildCombinedPrintDocument,
  buildPrintDocument,
  contentDispositionAttachment,
} from "@/lib/print-document";

describe("buildPrintDocument", () => {
  it("wraps the body in a full HTML document with an A4 page rule", () => {
    const html = buildPrintDocument({
      title: "Конспект",
      bodyHtml: "<p>Текст</p>",
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Конспект</title>");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain('<div class="content"><p>Текст</p></div>');
  });

  it("escapes the title but not the pre-rendered body", () => {
    const html = buildPrintDocument({
      title: 'A <b>& "B"',
      bodyHtml: "<table><tr><td>x</td></tr></table>",
    });
    expect(html).toContain("<title>A &lt;b&gt;&amp; &quot;B&quot;</title>");
    expect(html).toContain("<table><tr><td>x</td></tr></table>");
  });

  it("includes the meta line only when provided", () => {
    expect(
      buildPrintDocument({ title: "T", bodyHtml: "", meta: "Оновлено 01.01" }),
    ).toContain('<p class="doc-meta">Оновлено 01.01</p>');
    expect(buildPrintDocument({ title: "T", bodyHtml: "" })).not.toContain(
      '<p class="doc-meta">',
    );
  });
});

describe("buildCombinedPrintDocument", () => {
  it("renders one .doc-section per section with escaped headings", () => {
    const html = buildCombinedPrintDocument({
      title: "Матеріали",
      sections: [
        { heading: "Сторінка 1", bodyHtml: "<p>a</p>" },
        { heading: "A & B", bodyHtml: "<p>b</p>", meta: "Оновлено 02.02" },
      ],
    });
    expect(html.match(/class="doc-section"/g)).toHaveLength(2);
    expect(html).toContain('<h2 class="section-heading">Сторінка 1</h2>');
    expect(html).toContain('<h2 class="section-heading">A &amp; B</h2>');
    expect(html).toContain('<div class="content"><p>a</p></div>');
    expect(html).toContain('<p class="doc-meta">Оновлено 02.02</p>');
  });

  it("keeps a page break before every section except the first", () => {
    const html = buildCombinedPrintDocument({ title: "T", sections: [] });
    expect(html).toContain(".doc-section { break-before: page; }");
    expect(html).toContain(
      ".doc-section:first-of-type { break-before: auto; }",
    );
  });
});

describe("contentDispositionAttachment", () => {
  it("emits an ascii fallback and a UTF-8 filename*", () => {
    const header = contentDispositionAttachment("Конспект: рівняння.pdf");
    expect(header).toMatch(
      /^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/,
    );
    expect(header).toContain(encodeURIComponent("Конспект: рівняння.pdf"));
    expect(header).not.toContain("Конспект");
  });
});
