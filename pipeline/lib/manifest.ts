import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CASES_DIR, MANIFEST_PATH, caseDir } from "./paths.js";
import { parseCendojIdentity, parsePdfHeaderInfo } from "./pdfmeta.js";
import type { Manifest, ManifestEntry } from "./schema.js";

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function caseIdFromDir(name: string): string {
  const num = name.replace(/^case_/, "");
  return `CASE-${num}`;
}

function judgmentIdFromDir(name: string): string {
  const num = name.replace(/^case_/, "");
  return `JD-${num}`;
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    const items = await fs.readdir(dir);
    return items.filter((name) => !name.startsWith(".")).sort();
  } catch {
    return [];
  }
}

export async function scanCases(): Promise<ManifestEntry[]> {
  const dirs = (await fs.readdir(CASES_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^case_\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const entries: ManifestEntry[] = [];
  const structuredEnriched = new Set<string>();

  for (const dirName of dirs) {
    const dir = caseDir(dirName);
    const originalFiles = await listFiles(path.join(dir, "original"));
    const pdfName = originalFiles.find((name) => name.toLowerCase().endsWith(".pdf"));
    if (!pdfName) continue;

    const pdfPath = path.join(dir, "original", pdfName);
    const bytes = await fs.readFile(pdfPath);
    const header = parsePdfHeaderInfo(bytes);
    const identity = parseCendojIdentity(header);

    const structuredFiles = (await listFiles(path.join(dir, "structured"))).filter((name) =>
      name.endsWith(".json"),
    );
    if (structuredFiles.includes("review.json")) {
      try {
        const review = JSON.parse(
          await fs.readFile(path.join(dir, "structured", "review.json"), "utf8"),
        ) as { extraction?: { validation?: string } };
        if (review.extraction?.validation === "OK") structuredEnriched.add(dirName);
      } catch {
      }
    }
    const metadataFiles = (await listFiles(path.join(dir, "metadata"))).filter((name) =>
      name.endsWith(".json"),
    );

    const txtPath = path.join(dir, "extracted", "judgment.txt");
    const pagesPath = path.join(dir, "extracted", "pages.json");
    let pageCount = 0;
    let charCount = 0;
    let judgmentTxt = false;
    let pagesJson = false;
    try {
      const txt = await fs.readFile(txtPath, "utf8");
      judgmentTxt = true;
      charCount = txt.length;
      const pages = JSON.parse(await fs.readFile(pagesPath, "utf8")) as unknown[];
      pagesJson = true;
      pageCount = pages.length;
    } catch {
      pageCount = 0;
    }

    entries.push({
      caseDir: dirName,
      caseId: caseIdFromDir(dirName),
      judicialDecisionId: judgmentIdFromDir(dirName),
      pdf: {
        fileName: pdfName,
        bytes: bytes.length,
        sha256: sha256(bytes),
        title: header.title,
        subject: header.subject,
        keywords: header.keywords,
        roj: identity.roj,
        ecli: identity.ecli,
        court: identity.court,
      },
      metadataFiles,
      structuredFiles,
      enriched: false,
      extracted: { judgmentTxt, pagesJson, pageCount, charCount },
      duplicateOf: null,
    });
  }

  for (const entry of entries) {
    entry.enriched = structuredEnriched.has(entry.caseDir);
  }

  markDuplicates(entries);
  return entries;
}

export function markDuplicates(entries: ManifestEntry[]): void {
  const canonical = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.pdf.ecli) continue;
    const existing = canonical.get(entry.pdf.ecli);
    if (!existing) {
      canonical.set(entry.pdf.ecli, entry.caseDir);
      entry.duplicateOf = null;
    } else {
      entry.duplicateOf = existing;
    }
  }
}

export function buildManifest(entries: ManifestEntry[]): Manifest {
  const unique = new Set(entries.map((entry) => entry.pdf.ecli).filter(Boolean));
  return {
    generatedAt: new Date().toISOString(),
    totalCases: entries.length,
    uniqueDecisions: unique.size,
    duplicates: entries.filter((entry) => entry.duplicateOf !== null).length,
  processedStructured: entries.filter((entry) => entry.structuredFiles.length > 0).length,
  enriched: entries.filter((entry) => entry.enriched).length,
  withExtractedText: entries.filter((entry) => entry.extracted.judgmentTxt).length,
    entries,
  };
}

export async function saveManifest(manifest: Manifest): Promise<void> {
  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function loadManifest(): Promise<Manifest> {
  const raw = await fs.readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as Manifest;
}
