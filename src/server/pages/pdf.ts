import "server-only";

import puppeteer, { type Browser } from "puppeteer";

import {
  buildCombinedPrintDocument,
  buildPrintDocument,
  type PrintSection,
} from "@/lib/print-document";

/**
 * HTML -> PDF via a headless Chromium. One browser per process, reused across
 * requests (launching costs ~300ms); it is relaunched automatically if it dies.
 */

const globalForPuppeteer = globalThis as unknown as {
  pdfBrowser?: Promise<Browser> | undefined;
};

async function getBrowser(): Promise<Browser> {
  if (!globalForPuppeteer.pdfBrowser) {
    globalForPuppeteer.pdfBrowser = puppeteer
      .launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--font-render-hinting=none",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          globalForPuppeteer.pdfBrowser = undefined;
        });
        return browser;
      })
      .catch((error) => {
        globalForPuppeteer.pdfBrowser = undefined;
        throw error;
      });
  }
  return globalForPuppeteer.pdfBrowser;
}

async function htmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Render a page's rendered body HTML to a PDF byte array. */
export function renderPdf(input: {
  title: string;
  bodyHtml: string;
  meta?: string;
}): Promise<Uint8Array> {
  return htmlToPdf(buildPrintDocument(input));
}

/** Render several sections (lesson pages + optional whiteboard) to one PDF. */
export function renderCombinedPdf(input: {
  title: string;
  meta?: string;
  sections: PrintSection[];
}): Promise<Uint8Array> {
  return htmlToPdf(buildCombinedPrintDocument(input));
}
