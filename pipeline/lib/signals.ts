import fs from "node:fs/promises";
import path from "node:path";
import { CASES_DIR, caseDir } from "./paths.js";
import type { CaseSignals } from "./compare.js";

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function section<T>(caseId: string, file: string): Promise<T | null> {
  return readJson<T>(path.join(CASES_DIR, caseId, "structured", file));
}

/** Señales de un caso (extraídas por IA) o null si no existe enriquecimiento. */
export async function loadSignals(caseId: string): Promise<CaseSignals | null> {
  const [summary, classification, outcome, facts, claims, issues, args, reasoning, lawRefs] =
    await Promise.all([
      section<{
        summary?: { headline?: string; summary?: string; key_points?: string[] };
      }>(caseId, "summary.json"),
      section<{ classification?: { civil_branch?: string; subtopic?: string } }>(caseId, "classification.json"),
      section<{
        outcome?: { cassation_outcome?: string; recurring_side?: string };
      }>(caseId, "outcome.json"),
      section<{ facts?: Array<{ description?: string }> }>(caseId, "facts.json"),
      section<{ claims?: Array<{ description?: string }> }>(caseId, "claims.json"),
      section<{ issues?: Array<{ topic?: string; description?: string }> }>(caseId, "issues.json"),
      section<{ arguments?: Array<{ side?: string; type?: string; outcome?: string; description?: string }> }>(
        caseId,
        "arguments.json",
      ),
      section<{ holdings?: Array<{ topic?: string; statement?: string; doctrine?: string }> }>(
        caseId,
        "reasoning.json",
      ),
      section<{ refs?: Array<{ norma?: string; article_raw?: string; boe_id?: string | null; status?: string }> }>(
        caseId,
        "law_refs.json",
      ),
    ]);

  if (!summary?.summary?.headline) return null;

  return {
    id: caseId,
    headline: summary.summary.headline,
    subtopic: classification?.classification?.subtopic ?? "",
    branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
    recurringSide: outcome?.outcome?.recurring_side ?? "UNKNOWN",
    summary: summary.summary.summary ?? "",
    keyPoints: summary.summary.key_points ?? [],
    facts: (facts?.facts ?? []).map((fact) => fact.description ?? ""),
    claims: (claims?.claims ?? []).map((claim) => claim.description ?? ""),
    issues: (issues?.issues ?? []).map((issue) => `${issue.topic ?? ""}: ${issue.description ?? ""}`),
    argumentsList: (args?.arguments ?? []).map(
      (argument) =>
        `[${argument.side ?? "?"}/${argument.type ?? "?"} · ${argument.outcome ?? "?"}] ${argument.description ?? ""}`,
    ),
    holdings: (reasoning?.holdings ?? [])
      .filter((holding) => Boolean(holding.statement))
      .map((holding) => ({
        topic: holding.topic ?? "",
        statement: holding.statement ?? "",
        doctrine: holding.doctrine ?? "UNKNOWN",
      })),
    laws: (lawRefs?.refs ?? [])
      .filter((ref) => ref.status === "VERIFIED")
      .map((ref) => ({
        norma: ref.norma ?? "",
        article: ref.article_raw ?? "",
        boeId: ref.boe_id ?? null,
      })),
  };
}

export interface LawContext {
  sigla: string;
  boe_id: string;
  titulo: string;
  articulos: Array<{ titulo: string; texto: string }>;
}

interface NormBlock {
  id?: string;
  tipo?: string;
  titulo?: string;
  texto?: string;
}

function normNumber(value: string): string {
  return value.replace(/[.,\s]/g, "");
}

/**
 * Artículos verificados que cita el caso, con su texto consolidado del BOE.
 */
export async function loadLeyesForCase(caseId: string, maxNorms = 3, maxArticulos = 3): Promise<LawContext[]> {
  const refs = await section<{
    refs?: Array<{
      boe_id?: string | null;
      norma?: string;
      status?: string;
      articles?: Array<{ number?: number; block_id?: string; titulo?: string }>;
    }>;
  }>(caseId, "law_refs.json");
  const verified = (refs?.refs ?? []).filter(
    (ref) => ref.status === "VERIFIED" && typeof ref.boe_id === "string" && ref.boe_id.length > 0,
  );
  if (verified.length === 0) return [];

  const byNorm = new Map<string, { sigla: string; arts: Array<{ number?: number; block_id?: string; titulo?: string }> }>();
  for (const ref of verified) {
    const key = ref.boe_id as string;
    const entry = byNorm.get(key) ?? { sigla: ref.norma ?? key, arts: [] };
    for (const art of ref.articles ?? []) entry.arts.push(art);
    byNorm.set(key, entry);
  }

  const out: LawContext[] = [];
  for (const [boeId, entry] of byNorm) {
    if (out.length >= maxNorms) break;
    const norm = await readJson<{ titulo?: string; blocks?: NormBlock[] }>(path.join("laws", "norms", `${boeId}.json`));
    if (!norm) continue;
    const blocks = (norm.blocks ?? []).filter((block) => block.tipo === "precepto" && block.texto);
    const articulos: Array<{ titulo: string; texto: string }> = [];
    const seen = new Set<string>();
    for (const art of entry.arts) {
      if (articulos.length >= maxArticulos) break;
      const wanted = art.block_id ?? "";
      const number = typeof art.number === "number" ? normNumber(String(art.number)) : "";
      const block =
        blocks.find((item) => wanted && item.id === wanted) ??
        blocks.find((item) => {
          const title = normNumber(String(item.titulo ?? "")).toLowerCase();
          return number.length > 0 && (title === `art${number}` || title === `articulo${number}`);
        });
      if (!block?.texto || !block.titulo) continue;
      const key = block.titulo;
      if (seen.has(key)) continue;
      seen.add(key);
      articulos.push({ titulo: block.titulo, texto: block.texto.replace(/\s+/g, " ") });
    }
    if (articulos.length > 0) {
      out.push({ sigla: entry.sigla, boe_id: boeId, titulo: norm.titulo ?? boeId, articulos });
    }
  }
  return out;
}

/** Los casos más parecidos al indicado (BM25 sobre resumen + temas). */
export async function pickSimilares(primaryId: string, limit = 3): Promise<CaseSignals[]> {
  const names = (await fs.readdir(CASES_DIR).catch(() => [] as string[]))
    .filter((name) => /^case_\d{6}$/.test(name))
    .filter((name) => name !== primaryId);
  const all = await Promise.all(names.map((name) => loadSignals(name)));
  const primary = await loadSignals(primaryId);
  if (!primary) return [];

  const { buildIndex, search } = await import("./search.js");
  const docs = all
    .filter((item): item is CaseSignals => Boolean(item))
    .map((item) => ({
      id: item.id,
      kind: "case" as const,
      meta: {},
      title: item.headline,
      body: `${item.summary}\n${item.issues.join("\n")}`,
    }));
  const index = buildIndex(docs);
  const hits = search(index, `${primary.headline} ${primary.subtopic} ${primary.issues.join(" ")}`, { limit });
  const byId = new Map(all.filter((item): item is CaseSignals => Boolean(item)).map((item) => [item.id, item]));
  return hits.map((hit) => byId.get(hit.id)).filter((item): item is CaseSignals => Boolean(item));
}

export { caseDir };
