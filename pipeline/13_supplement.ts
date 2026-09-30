import fs from "node:fs/promises";
import path from "node:path";
import { missingCitations, type DetectedCitation } from "./lib/law_detector.js";
import { CASES_DIR } from "./lib/paths.js";

interface Citation {
  citation_id?: string;
  raw_text?: string;
  norma?: string;
  article?: string;
  boe_id?: string;
  quote?: string;
  relevance?: string;
  sources?: Array<{ page: number }>;
  detection?: string;
}

interface CitedLaws {
  case_id?: string;
  citations?: Citation[];
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function toCitation(item: DetectedCitation, position: number): Citation {
  return {
    citation_id: `DET-${String(position).padStart(3, "0")}`,
    raw_text: item.raw,
    norma: item.sigla,
    article: item.article === null ? "UNKNOWN" : String(item.article),
    boe_id: item.boe_id,
    quote: "UNKNOWN",
    relevance: "CITED",
    sources: [],
    detection: "rules",
  };
}

async function main(): Promise<void> {
  const caseNames = (await fs.readdir(CASES_DIR)).filter((name) => /^case_\d{6}$/.test(name)).sort();

  let touched = 0;
  let added = 0;
  let skippedCases = 0;
  const bySigla = new Map<string, number>();
  const details: string[] = [];

  for (const caseId of caseNames) {
    const review = await readJson<{ extraction?: { validation?: string } }>(
      path.join(CASES_DIR, caseId, "structured", "review.json"),
    );
    if (review?.extraction?.validation !== "OK") {
      skippedCases += 1;
      continue;
    }
    const citedPath = path.join(CASES_DIR, caseId, "structured", "cited_laws.json");
    const cited = await readJson<CitedLaws>(citedPath);
    if (!cited) continue;
    const text = await fs
      .readFile(path.join(CASES_DIR, caseId, "extracted", "judgment.txt"), "utf8")
      .catch(() => "");
    if (!text) continue;

    const missing = missingCitations(text, cited.citations ?? []);
    if (missing.length === 0) continue;

    const start = (cited.citations ?? []).length;
    const appended = missing.map((item, index) => toCitation(item, start + index + 1));
    cited.citations = [...(cited.citations ?? []), ...appended];
    await fs.writeFile(citedPath, `${JSON.stringify(cited, null, 2)}\n`, "utf8");

    touched += 1;
    added += appended.length;
    for (const item of appended) {
      const sigla = item.norma ?? "?";
      bySigla.set(sigla, (bySigla.get(sigla) ?? 0) + 1);
    }
    details.push(
      `${caseId}: +${appended.length} → ${appended.map((item) => `${item.norma}${item.article !== "UNKNOWN" ? ` ${item.article}` : ""}`).join(", ")}`,
    );
  }

  process.stdout.write("\n== SUPLEMENTO DE CITAS (reglas) ==\n");
  process.stdout.write(`Casos analizados: ${caseNames.length - skippedCases} (omitidos: ${skippedCases})\n`);
  process.stdout.write(`Casos con citas añadidas: ${touched}\n`);
  process.stdout.write(`Citas añadidas: ${added}\n`);
  const ranked = [...bySigla.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0) {
    process.stdout.write("Por norma:\n");
    for (const [sigla, count] of ranked) process.stdout.write(`  ${sigla}: ${count}\n`);
  }
  for (const line of details.slice(0, 25)) process.stdout.write(`  - ${line}\n`);
  if (added > 0) {
    process.stdout.write("\nSiguiente: pnpm match (verifica las nuevas citas) y pnpm run eval\n");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
