import fs from "node:fs/promises";
import path from "node:path";
import {
  buildArticleIndex,
  checkQuote,
  parseArticleNumbers,
  resolveNorma,
  splitCombinedNorma,
  type NormaKind,
  type NormaRef,
} from "./lib/citations.js";
import { CASES_DIR, LAWS_DIR } from "./lib/paths.js";
import type { LawNorm } from "./lib/citations.js";

interface RawCitation {
  citation_id?: string;
  raw_text?: string;
  norma?: string;
  article?: string;
  boe_id?: string;
  quote?: string;
  relevance?: string;
  sources?: Array<{ page: number }>;
}

type RefStatus =
  | "VERIFIED"
  | "PARTIAL"
  | "ARTICLE_NOT_FOUND"
  | "NO_ARTICLE"
  | "TEXT_MISSING"
  | "AI_ID_UNVERIFIED"
  | "UNKNOWN_NORM"
  | "NON_BOE";

interface ArticleRef {
  number: number;
  block_id: string | null;
  titulo: string | null;
  status: "VERIFIED" | "ARTICLE_NOT_FOUND";
}

interface Ref {
  citation_id: string;
  raw_text: string;
  norma: string;
  article_raw: string;
  norma_kind: NormaKind;
  boe_id: string | null;
  ai_boe_id: string | null;
  ai_boe_id_in_catalog: boolean | null;
  id_source: "pipeline" | "ai" | null;
  id_conflict: boolean;
  vigencia_agotada: string | null;
  status: RefStatus;
  articles: ArticleRef[];
  quote: string;
  quote_check: "MATCH" | "MISMATCH" | "NOT_CHECKED";
  relevance: string;
  sources: Array<{ page: number }>;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

interface CatalogNorm {
  identificador: string;
  numero_oficial: string;
  titulo: string;
  ambito: { codigo: string; texto: string };
  vigencia_agotada: string;
}

async function loadNorms(): Promise<Map<string, LawNorm>> {
  const dir = path.join(LAWS_DIR, "norms");
  const map = new Map<string, LawNorm>();
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return map;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const norm = await readJson<LawNorm>(path.join(dir, name));
    if (norm?.boe_id) map.set(norm.boe_id, norm);
  }
  return map;
}

async function loadCatalogRefs(): Promise<{
  byNumero: Map<string, NormaRef[]>;
  byId: Map<string, NormaRef>;
}> {
  const catalog = await readJson<{ norms?: CatalogNorm[] }>(path.join(LAWS_DIR, "catalog.json"));
  const byNumero = new Map<string, NormaRef[]>();
  const byId = new Map<string, NormaRef>();
  for (const norm of catalog?.norms ?? []) {
    const ref: NormaRef = {
      identificador: norm.identificador,
      titulo: norm.titulo,
      ambito: norm.ambito?.codigo ?? "",
      vigencia_agotada: norm.vigencia_agotada,
    };
    byId.set(norm.identificador, ref);
    const key = (norm.numero_oficial ?? "").replace(/\s+/g, "");
    if (!key) continue;
    const list = byNumero.get(key) ?? [];
    list.push(ref);
    byNumero.set(key, list);
  }
  return { byNumero, byId };
}

function classify(
  kind: NormaKind,
  boeId: string | null,
  loaded: LawNorm | undefined,
  vigencia: string | null,
  articles: ArticleRef[],
): { status: RefStatus; vigencia: string | null } {
  if (kind === "non_boe") return { status: "NON_BOE", vigencia };
  if (!boeId) return { status: "UNKNOWN_NORM", vigencia };
  if (kind === "ai_unverified") return { status: "AI_ID_UNVERIFIED", vigencia };
  if (!loaded) return { status: "TEXT_MISSING", vigencia };
  if (articles.length === 0) return { status: "NO_ARTICLE", vigencia };
  const found = articles.filter((article) => article.status === "VERIFIED").length;
  if (found === articles.length) return { status: "VERIFIED", vigencia };
  if (found === 0) return { status: "ARTICLE_NOT_FOUND", vigencia };
  return { status: "PARTIAL", vigencia };
}

function buildRef(
  citation: RawCitation,
  index: Map<string, Map<number, string>>,
  norms: Map<string, LawNorm>,
  numeroOficial: Map<string, NormaRef[]>,
  byId: Map<string, NormaRef>,
): Ref {
  const norma = citation.norma ?? "";
  const articleRaw = citation.article ?? "";
  const parts = splitCombinedNorma(norma);
  const resolved =
    parts.length > 1
      ? parts
          .map((part) => resolveNorma(part, numeroOficial))
          .find((result) => result.boe_id !== null) ?? resolveNorma(norma, numeroOficial)
      : resolveNorma(norma, numeroOficial);

  const aiBoeId = citation.boe_id && /^BOE-A-\d{4}-\d+$/.test(citation.boe_id) ? citation.boe_id : null;
  const esNoBoe = resolved.kind === "non_boe";
  let boeId: string | null = null;
  let kind: NormaKind = resolved.kind;
  let idSource: Ref["id_source"] = null;
  let idConflict = false;

  if (esNoBoe) {
    kind = "non_boe";
  } else if (resolved.boe_id) {
    boeId = resolved.boe_id;
    idSource = "pipeline";
    idConflict = aiBoeId !== null && aiBoeId !== boeId;
  } else if (aiBoeId) {
    boeId = aiBoeId;
    kind = "ai_unverified";
    idSource = "ai";
  }

  const loaded = boeId ? norms.get(boeId) : undefined;
  const numbers = parseArticleNumbers(articleRaw);
  const articles: ArticleRef[] = [];
  if (loaded && numbers.length > 0) {
    const articleIndex = index.get(loaded.boe_id);
    for (const number of numbers) {
      const blockId = articleIndex?.get(number) ?? null;
      const block = blockId ? loaded.blocks.find((item) => item.id === blockId) : undefined;
      articles.push({
        number,
        block_id: blockId,
        titulo: block?.titulo ?? null,
        status: blockId ? "VERIFIED" : "ARTICLE_NOT_FOUND",
      });
    }
  }

  const vigenciaNorma = boeId ? (byId.get(boeId)?.vigencia_agotada ?? null) : null;
  const { status, vigencia } = classify(kind, boeId, loaded, vigenciaNorma, articles);

  let quoteCheck: Ref["quote_check"] = "NOT_CHECKED";
  const quote = citation.quote ?? "UNKNOWN";
  const firstBlockId = articles[0]?.block_id;
  if (loaded && quote !== "UNKNOWN" && quote.trim().length > 0 && firstBlockId) {
    const block = loaded.blocks.find((item) => item.id === firstBlockId);
    if (block) quoteCheck = checkQuote(block.texto, quote);
  }

  return {
    citation_id: citation.citation_id ?? "",
    raw_text: citation.raw_text ?? "",
    norma,
    article_raw: articleRaw,
    norma_kind: kind,
    boe_id: boeId,
    ai_boe_id: aiBoeId,
    ai_boe_id_in_catalog: aiBoeId === null ? null : byId.has(aiBoeId),
    id_source: idSource,
    id_conflict: idConflict,
    vigencia_agotada: vigencia,
    status,
    articles,
    quote,
    quote_check: quoteCheck,
    relevance: citation.relevance ?? "UNKNOWN",
    sources: citation.sources ?? [],
  };
}

async function main(): Promise<void> {
  const norms = await loadNorms();
  const { byNumero, byId } = await loadCatalogRefs();
  const index = new Map<string, Map<number, string>>();
  for (const norm of norms.values()) {
    index.set(norm.boe_id, buildArticleIndex(norm.blocks));
  }

  const caseNames = (await fs.readdir(CASES_DIR)).filter((name) => name.startsWith("case_")).sort();
  const statusCounts: Record<string, number> = {};
  const quoteCounts: Record<string, number> = {};
  let idConflicts = 0;
  let aiIdsMissing = 0;
  let aiIdsProvided = 0;
  const byArticle = new Map<string, { boe_id: string; number: number; titulo: string; cases: Set<string>; count: number }>();
  const byNorm = new Map<string, { boe_id: string; siglas: Set<string>; titulo: string; cases: Set<string>; count: number }>();
  const byCase: Array<{ case_id: string; total: number; verified: number; unresolved: number }> = [];
  let processed = 0;

  for (const caseName of caseNames) {
    const filePath = path.join(CASES_DIR, caseName, "structured", "cited_laws.json");
    const data = await readJson<{ case_id?: string; citations?: RawCitation[] }>(filePath);
    if (!data || !Array.isArray(data.citations)) continue;
    processed += 1;

    const refs = data.citations.map((citation) =>
      buildRef(citation, index, norms, byNumero, byId),
    );
    const counts: Record<string, number> = {};
    for (const ref of refs) {
      counts[ref.status] = (counts[ref.status] ?? 0) + 1;
      statusCounts[ref.status] = (statusCounts[ref.status] ?? 0) + 1;
      quoteCounts[ref.quote_check] = (quoteCounts[ref.quote_check] ?? 0) + 1;
      if (ref.id_conflict) idConflicts += 1;
      if (ref.ai_boe_id !== null) {
        aiIdsProvided += 1;
        if (ref.ai_boe_id_in_catalog === false) aiIdsMissing += 1;
      }
      if (ref.boe_id) {
        const norm = norms.get(ref.boe_id);
        const entry =
          byNorm.get(ref.boe_id) ??
          {
            boe_id: ref.boe_id,
            siglas: new Set<string>(),
            titulo: norm?.titulo ?? ref.boe_id,
            cases: new Set<string>(),
            count: 0,
          };
        entry.count += 1;
        entry.cases.add(caseName);
        if (ref.norma) entry.siglas.add(ref.norma);
        byNorm.set(ref.boe_id, entry);
      }
      for (const article of ref.articles) {
        if (article.status !== "VERIFIED" || !article.block_id) continue;
        const key = `${ref.boe_id}#${article.number}`;
        const entry =
          byArticle.get(key) ??
          {
            boe_id: ref.boe_id ?? "",
            number: article.number,
            titulo: article.titulo ?? "",
            cases: new Set<string>(),
            count: 0,
          };
        entry.count += 1;
        entry.cases.add(caseName);
        byArticle.set(key, entry);
      }
    }

    const verified = refs.filter((ref) => ref.status === "VERIFIED").length;
    const unresolved = refs.filter(
      (ref) => ref.status === "UNKNOWN_NORM" || ref.status === "ARTICLE_NOT_FOUND",
    ).length;
    byCase.push({ case_id: caseName, total: refs.length, verified, unresolved });

    await writeJson(path.join(CASES_DIR, caseName, "structured", "law_refs.json"), {
      case_id: data.case_id ?? caseName,
      generated_at: new Date().toISOString(),
      source_file: "structured/cited_laws.json",
      summary: counts,
      refs,
    });
  }

  const aggregate = {
    generated_at: new Date().toISOString(),
    cases: processed,
    norms_loaded: norms.size,
    status_counts: statusCounts,
    quote_counts: quoteCounts,
    id_conflicts: idConflicts,
    ai_ids_provided: aiIdsProvided,
    ai_ids_not_in_catalog: aiIdsMissing,
    by_norm: [...byNorm.values()]
      .map((entry) => ({
        boe_id: entry.boe_id,
        titulo: entry.titulo,
        siglas: [...entry.siglas],
        citations: entry.count,
        cases: [...entry.cases].sort(),
      }))
      .sort((a, b) => b.citations - a.citations),
    by_article: [...byArticle.values()]
      .map((entry) => ({
        boe_id: entry.boe_id,
        article: entry.number,
        titulo: entry.titulo,
        citations: entry.count,
        cases: [...entry.cases].sort(),
      }))
      .sort((a, b) => b.citations - a.citations),
    by_case: byCase,
  };
  await writeJson(path.join(LAWS_DIR, "case_citations.json"), aggregate);

  process.stdout.write("\n== FASE E: CRUCE CASO ↔ LEYES ==\n");
  process.stdout.write(`Casos analizados: ${processed}\n`);
  process.stdout.write(`Normas con texto cargado: ${norms.size}\n`);
  const total = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
  process.stdout.write(`Citas totales: ${total}\n`);
  process.stdout.write(
    `boe_id aportados por la IA: ${aiIdsProvided} · no existen en el catálogo BOE: ${aiIdsMissing}\n`,
  );
  process.stdout.write(`boe_id de la IA contradicho por el catálogo: ${idConflicts}\n`);
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${status.padEnd(20)} ${count}\n`);
  }
  process.stdout.write("Comprobación de citas textuales:\n");
  for (const [check, count] of Object.entries(quoteCounts).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${check.padEnd(20)} ${count}\n`);
  }
  process.stdout.write("Normas más citadas:\n");
  for (const entry of aggregate.by_norm.slice(0, 10)) {
    process.stdout.write(`  ${entry.citations}\t${entry.boe_id}\t${entry.titulo.slice(0, 70)}\n`);
  }
  process.stdout.write("Artículos más citados:\n");
  for (const entry of aggregate.by_article.slice(0, 10)) {
    process.stdout.write(
      `  ${entry.citations}\tart. ${entry.article} (${entry.boe_id})\t${entry.titulo}\tcasos=${entry.cases.length}\n`,
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
