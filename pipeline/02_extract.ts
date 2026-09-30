import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { buildManifest, saveManifest, scanCases } from "./lib/manifest.js";
import { assessExtraction } from "./lib/extract_quality.js";
import { REPO_ROOT, caseDir } from "./lib/paths.js";
import { itemsToLines, type TextItemLike } from "./lib/textlines.js";

interface RawTextItem {
  str?: unknown;
  transform?: unknown;
  width?: unknown;
  hasEOL?: unknown;
}

interface ExtractedPage {
  page: number;
  lines: string[];
}

const STANDARD_FONTS_URL = `${pathToFileURL(
  path.join(REPO_ROOT, "node_modules", "pdfjs-dist", "standard_fonts"),
).href}/`;

function toTextItem(raw: RawTextItem): TextItemLike | null {
  if (typeof raw.str !== "string") return null;
  const hasEOL = raw.hasEOL === true;
  if (raw.str.length === 0 && !hasEOL) return null;
  if (!Array.isArray(raw.transform)) return null;
  const transform = raw.transform as number[];
  const x = transform[4];
  const y = transform[5];
  if (typeof x !== "number" || typeof y !== "number") return null;
  return {
    str: raw.str,
    x,
    y,
    width: typeof raw.width === "number" ? raw.width : 0,
    hasEOL,
  };
}

async function extractPdf(pdfPath: string): Promise<ExtractedPage[]> {
  const data = await fs.readFile(pdfPath);
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: false,
    standardFontDataUrl: STANDARD_FONTS_URL,
  });
  const doc = await loadingTask.promise;
  const pages: ExtractedPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: TextItemLike[] = [];
      for (const raw of content.items as RawTextItem[]) {
        const item = toTextItem(raw);
        if (item) items.push(item);
      }
      pages.push({ page: pageNumber, lines: itemsToLines(items) });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
}

function renderJudgmentText(pages: ExtractedPage[]): string {
  return pages
    .map((page) => `\n===== PAGINA ${page.page} =====\n\n${page.lines.join("\n")}`)
    .join("\n");
}

function parseArgs(argv: string[]): { force: boolean; limit: number | null } {
  let force = false;
  let limit: number | null = null;
  for (const arg of argv) {
    if (arg === "--force") force = true;
    const limitMatch = arg.match(/^--limit=(\d+)$/);
    if (limitMatch?.[1]) limit = Number(limitMatch[1]);
  }
  return { force, limit };
}

async function main(): Promise<void> {
  const { force, limit } = parseArgs(process.argv.slice(2));
  const entries = await scanCases();
  const targets = limit === null ? entries : entries.slice(0, limit);
  let done = 0;
  let skipped = 0;
  const errors: string[] = [];
  const scanned: string[] = [];

  for (const entry of targets) {
    const extractedDir = path.join(caseDir(entry.caseDir), "extracted");
    const txtPath = path.join(extractedDir, "judgment.txt");
    const pagesPath = path.join(extractedDir, "pages.json");

    if (!force && entry.extracted.judgmentTxt && entry.extracted.pagesJson) {
      skipped += 1;
      continue;
    }

    try {
      const pages = await extractPdf(path.join(caseDir(entry.caseDir), "original", entry.pdf.fileName));
      const quality = assessExtraction(pages);
      await fs.mkdir(extractedDir, { recursive: true });
      await fs.writeFile(
        path.join(extractedDir, "quality.json"),
        `${JSON.stringify({ ...quality, generated_at: new Date().toISOString() }, null, 2)}\n`,
        "utf8",
      );
      await fs.writeFile(pagesPath, `${JSON.stringify(pages, null, 1)}\n`, "utf8");

      if (!quality.hasText) {
        scanned.push(entry.caseDir);
        await fs.rm(txtPath, { force: true });
        process.stdout.write(`${entry.caseDir}: ${quality.reason}\n`);
        continue;
      }

      const text = renderJudgmentText(pages);
      await fs.writeFile(txtPath, text, "utf8");
      done += 1;
      process.stdout.write(
        `${entry.caseDir}: ${pages.length} paginas, ${text.length} chars\n`,
      );
    } catch (error) {
      errors.push(`${entry.caseDir}: ${String(error)}`);
      process.stdout.write(`${entry.caseDir}: ERROR ${String(error)}\n`);
    }
  }

  const manifest = buildManifest(await scanCases());
  await saveManifest(manifest);

  process.stdout.write("\n== FASE B: EXTRACCION DE TEXTO ==\n");
  process.stdout.write(`Extraidos: ${done}\n`);
  process.stdout.write(`Omitidos (ya existian): ${skipped}\n`);
  if (scanned.length > 0) {
    process.stdout.write(`Sin texto (posible escaneo, falta OCR): ${scanned.length}\n`);
    for (const caseDirName of scanned) process.stdout.write(` - ${caseDirName}\n`);
  }
  process.stdout.write(`Errores: ${errors.length}\n`);
  process.stdout.write(`Con texto: ${manifest.withExtractedText}/${manifest.totalCases}\n`);
  if (errors.length > 0) {
    for (const error of errors) process.stdout.write(` - ${error}\n`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
