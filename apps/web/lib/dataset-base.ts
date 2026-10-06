import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { normalizeKey } from "@pipeline/patterns";

let cachedRoot: string | null = null;

export function repoRoot(): string {
  if (cachedRoot) return cachedRoot;
  const candidates = [
    process.env.MANTIJUDICIAL_ROOT,
    path.resolve(process.cwd(), "..", ".."),
    process.cwd(),
    path.resolve(/* turbopackIgnore: true */ process.cwd(), ".."),
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "cases"))) {
      cachedRoot = candidate;
      return candidate;
    }
  }
  throw new Error("No se encuentra el corpus (carpeta cases/). Define MANTIJUDICIAL_ROOT.");
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    // ENOENT es normal (el fichero aún no existe); el resto (JSON roto,
    // permisos…) se avisa para no perder silenciosamente información.
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(`[dataset] No se pudo leer ${filePath}: ${String(error)}`);
    }
    return null;
  }
}

export interface CaseListItem {
  id: string;
  headline: string;
  subtopic: string;
  branch: string;
  outcome: string;
  recurringSide: string;
  enriched: boolean;
  reviewStatus: string;
  /** El PDF es más nuevo que la última extracción: toca reanalizar. */
  stale: boolean;
  /** Archivado: se oculta de la lista de casos (no se borra nada). */
  archived: boolean;
  /** ECLI/ROJ del PDF (del manifiesto), si consta. */
  ecli?: string;
  roj?: string;
  /** Fecha en que se analizó el caso (extraction.generated_at). */
  generatedAt: string;
  /** Última revisión humana (review.reviewed_at). */
  reviewedAt: string;
}

export async function isStale(caseId: string, generatedAt: string | undefined): Promise<boolean> {
  const dir = path.join(repoRoot(), "cases", caseId, "original");
  try {
    const names = await fs.readdir(dir);
    if (names.length === 0) return false;
    const stats = await Promise.all(
      names.map((name) => fs.stat(path.join(dir, name)).catch(() => null)),
    );
    const newest = Math.max(0, ...stats.map((stat) => stat?.mtimeMs ?? 0));
    if (newest === 0) return false;
    if (!generatedAt) return true;
    const analysed = Date.parse(generatedAt);
    if (Number.isNaN(analysed)) return true;
    return newest > analysed;
  } catch {
    return false;
  }
}


export async function caseNames(): Promise<string[]> {
  const dir = path.join(repoRoot(), "cases");
  const entries = await fs.readdir(dir);
  return entries.filter((name) => name.startsWith("case_")).sort();
}

/** Formato de caso válido: única puerta de entrada a ficheros bajo
 * cases/. Defensa en profundidad: las APIs ya validan, pero aquí no se
 * escapa nunca un caseId inventado (traversal) aunque se olvide un validador. */
export function esCaseId(caseId: string): boolean {
  return /^case_\d{6}$/.test(caseId);
}

export async function section<T>(caseId: string, file: string): Promise<T | null> {
  if (!esCaseId(caseId)) return null;
  return readJson<T>(path.join(repoRoot(), "cases", caseId, "structured", file));
}

function archivedFlagPath(caseId: string): string {
  return path.join(repoRoot(), "cases", caseId, "archived.flag");
}

/** ¿Está archivado el caso? (marcador en cases/<id>/archived.flag). */
export async function isArchived(caseId: string): Promise<boolean> {
  if (!esCaseId(caseId)) return false;
  return fs
    .access(archivedFlagPath(caseId))
    .then(() => true)
    .catch(() => false);
}

export async function setArchived(caseId: string, archived: boolean): Promise<void> {
  if (!esCaseId(caseId)) throw new Error(`caseId no válido: ${caseId}`);
  const file = archivedFlagPath(caseId);
  if (archived) await fs.writeFile(file, `${new Date().toISOString()}\n`, "utf8");
  else await fs.rm(file, { force: true });
  todosCache = null;
}

export async function listCases(filters: {
  branch?: string;
  outcome?: string;
  q?: string;
} = {}): Promise<CaseListItem[]> {
  const todos = await listarTodos();
  return todos.filter((item) => {
    if (filters.branch && item.branch !== filters.branch) return false;
    if (filters.outcome && item.outcome !== filters.outcome) return false;
    if (filters.q) {
      const needle = filters.q.toLowerCase();
      const haystack = `${item.id} ${item.headline} ${item.subtopic}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

let todosCache: { value: CaseListItem[]; at: number } | null = null;
const TODOS_TTL_MS = 10_000;

/** Lista completa con cache corta: evita releer ~320 ficheros en cada página. */
async function listarTodos(): Promise<CaseListItem[]> {
  if (todosCache && Date.now() - todosCache.at < TODOS_TTL_MS) return todosCache.value;
  const names = await caseNames();
  const items: CaseListItem[] = [];
  const manifest = await readJson<{
    entries?: Array<{ caseDir: string; pdf: { ecli: string | null; roj: string | null } }>;
  }>(path.join(repoRoot(), "cases", "manifest.json"));
  const pdfs = new Map(
    (manifest?.entries ?? []).map((entry) => [entry.caseDir, entry.pdf] as const),
  );
  for (const name of names) {
    const review = await section<{ extraction?: { validation?: string } }>(name, "review.json");
    const classification = await section<{
      classification?: { civil_branch?: string; subtopic?: string };
    }>(name, "classification.json");
    const summary = await section<{ summary?: { headline?: string } }>(name, "summary.json");
    const outcome = await section<{
      outcome?: { cassation_outcome?: string; recurring_side?: string };
    }>(name, "outcome.json");

    const generatedAt = (review as { extraction?: { generated_at?: string } } | null)?.extraction
      ?.generated_at;
    items.push({
      id: name,
      headline: summary?.summary?.headline ?? name,
      subtopic: classification?.classification?.subtopic ?? "",
      branch: classification?.classification?.civil_branch ?? "UNKNOWN",
      outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
      recurringSide: outcome?.outcome?.recurring_side ?? "UNKNOWN",
      enriched: review?.extraction?.validation === "OK",
      reviewStatus:
        (review as { review?: { status?: string } } | null)?.review?.status ?? "UNREVIEWED",
      stale: await isStale(name, generatedAt),
      archived: await isArchived(name),
      generatedAt: generatedAt ?? "",
      reviewedAt:
        (review as { review?: { reviewed_at?: string } } | null)?.review?.reviewed_at ?? "",
      ecli: pdfs.get(name)?.ecli ?? "",
      roj: pdfs.get(name)?.roj ?? "",
    });
  }
  todosCache = { value: items, at: Date.now() };
  return items;
}

export interface LawIndexEntry {
  boe_id: string;
  titulo: string;
  blocks: number;
  chars: number;
  retrieved_at: string;
}

export async function listLaws(): Promise<LawIndexEntry[]> {
  const index = await readJson<{ norms?: LawIndexEntry[] }>(path.join(repoRoot(), "laws", "index.json"));
  return index?.norms ?? [];
}

export async function readFirstJson<T>(dirPath: string): Promise<T | null> {
  const names = await fs.readdir(dirPath).catch(() => [] as string[]);
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const value = await readJson<T>(path.join(dirPath, name));
    if (value) return value;
  }
  return null;
}

export interface EvolucionCaso {
  fecha: string;
  caseId: string;
  headline: string;
  outcome: string;
  branch: string;
  frase: string;
  doctrine: string;
}

export interface EvolucionTema {
  topic: string;
  cases: number;
  distribution: Record<string, number>;
  first: string;
  last: string;
  entries: EvolucionCaso[];
}

/** Evolución de un mismo tema (holding) a lo largo del corpus, por fecha. */
let evolucionCache: { value: EvolucionTema[]; at: number } | null = null;

export async function getEvolucion(): Promise<EvolucionTema[]> {
  if (evolucionCache && Date.now() - evolucionCache.at < 60_000) return evolucionCache.value;
  const caseNames = (await fs.readdir(path.join(repoRoot(), "cases"))).filter((name) =>
    /^case_\d{6}$/.test(name),
  );
  const groups = new Map<
    string,
    { cases: Map<string, EvolucionCaso>; distribution: Record<string, number> }
  >();

  for (const caseId of caseNames) {
    const [meta, reasoning, classification, outcome, summary] = await Promise.all([
      readFirstJson<{ resolution_date?: string }>(path.join(repoRoot(), "cases", caseId, "metadata")),
      section<{ holdings?: Array<{ topic?: string; statement?: string; doctrine?: string }> }>(
        caseId,
        "reasoning.json",
      ),
      section<{ classification?: { civil_branch?: string } }>(caseId, "classification.json"),
      section<{ outcome?: { cassation_outcome?: string } }>(caseId, "outcome.json"),
      section<{ summary?: { headline?: string } }>(caseId, "summary.json"),
    ]);
    const review = await section<{ extraction?: { validation?: string } }>(caseId, "review.json");
    if (review?.extraction?.validation !== "OK") continue;
    const fecha = meta?.resolution_date ?? "";
    const caseOutcome = outcome?.outcome?.cassation_outcome ?? "UNKNOWN";

    for (const holding of reasoning?.holdings ?? []) {
      const key = normalizeKey(holding.topic ?? "");
      if (!key) continue;
      const group = groups.get(key) ?? {
        cases: new Map<string, EvolucionCaso>(),
        distribution: {},
      };
      if (!group.cases.has(caseId)) {
        group.cases.set(caseId, {
          fecha,
          caseId,
          headline: summary?.summary?.headline ?? caseId,
          outcome: caseOutcome,
          branch: classification?.classification?.civil_branch ?? "UNKNOWN",
          frase: holding.statement ?? "",
          doctrine: holding.doctrine ?? "UNKNOWN",
        });
        group.distribution[caseOutcome] = (group.distribution[caseOutcome] ?? 0) + 1;
      }
      groups.set(key, group);
    }
  }

  const value = [...groups.entries()]
    .map(([topic, group]) => {
      const entries = [...group.cases.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
      return {
        topic,
        cases: entries.length,
        distribution: group.distribution,
        first: entries[0]?.fecha ?? "",
        last: entries[entries.length - 1]?.fecha ?? "",
        entries,
      };
    })
    .filter((item) => item.cases >= 3)
    .sort((a, b) => b.cases - a.cases || a.topic.localeCompare(b.topic));
  evolucionCache = { value, at: Date.now() };
  return value;
}

/** Tipos estructurales de las secciones de un caso (JSON de structured/).
 * Todos los campos opcionales: el JSON puede venir incompleto. */
export type Party = {
  party_id?: string;
  name?: string;
  side?: string;
  kind?: string;
  representation?: string;
  is_consumer?: string;
  notes?: string;
};
export type Claim = {
  claim_id?: string;
  claimant?: string;
  side?: string;
  description?: string;
  outcome?: string;
  outcome_scope?: string;
};
export type Fact = {
  fact_id?: string;
  description?: string;
  fact_type?: string;
  status?: string;
  importance?: number;
};
export type Event = { event_id?: string; date?: string; description?: string; event_type?: string };
export type Argument = {
  argument_id?: string;
  side?: string;
  type?: string;
  description?: string;
  legal_basis?: string;
  outcome?: string;
  importance?: number;
};
export type Holding = {
  holding_id?: string;
  statement?: string;
  topic?: string;
  legal_basis?: string;
  doctrine?: string;
  importance?: number;
  is_literal_quote?: boolean;
};
export type Issue = { issue_id?: string; topic?: string; description?: string; importance?: number };
export type Citation = {
  citation_id?: string;
  raw_text?: string;
  norma?: string;
  article?: string;
  relevance?: string;
};
export type Ref = {
  norma?: string;
  article_raw?: string;
  boe_id?: string | null;
  ai_boe_id?: string | null;
  id_conflict?: boolean;
  id_source?: string | null;
  status?: string;
  quote_check?: string;
  articles?: Array<{ number?: number; block_id?: string | null; titulo?: string | null; status?: string }>;
};

export interface CaseDetail extends CaseListItem {
  summary: Record<string, unknown> | null;
  parties: Party[];
  claims: Claim[];
  facts: Fact[];
  timeline: Event[];
  arguments: Argument[];
  reasoning: Holding[];
  issues: Issue[];
  citedLaws: Citation[];
  outcomeDetail: Record<string, unknown> | null;
  lawRefs: Ref[];
  review: Record<string, unknown> | null;
}

export async function getCase(caseId: string): Promise<CaseDetail | null> {
  if (!esCaseId(caseId)) return null;
  const [summary, classification, outcome, parties, claims, facts, timeline, args, reasoning, issues, citedLaws, lawRefs, review] =
    await Promise.all([
      section<Record<string, unknown>>(caseId, "summary.json"),
      section<{ classification?: Record<string, unknown> }>(caseId, "classification.json"),
      section<Record<string, unknown>>(caseId, "outcome.json"),
      section<{ parties?: Party[] }>(caseId, "parties.json"),
      section<{ claims?: Claim[] }>(caseId, "claims.json"),
      section<{ facts?: Fact[] }>(caseId, "facts.json"),
      section<{ events?: Event[] }>(caseId, "timeline.json"),
      section<{ arguments?: Argument[] }>(caseId, "arguments.json"),
      section<{ holdings?: Holding[] }>(caseId, "reasoning.json"),
      section<{ issues?: Issue[] }>(caseId, "issues.json"),
      section<{ citations?: Citation[] }>(caseId, "cited_laws.json"),
      section<{ refs?: Ref[] }>(caseId, "law_refs.json"),
      section<Record<string, unknown>>(caseId, "review.json"),
    ]);

  if (!outcome && !summary) return null;

  return {
    id: caseId,
    headline:
      (summary?.summary as { headline?: string } | undefined)?.headline ?? caseId,
    subtopic: (classification?.classification as { subtopic?: string } | undefined)?.subtopic ?? "",
    branch: (classification?.classification as { civil_branch?: string } | undefined)?.civil_branch ?? "UNKNOWN",
    outcome: (outcome?.outcome as { cassation_outcome?: string } | undefined)?.cassation_outcome ?? "UNKNOWN",
    recurringSide: (outcome?.outcome as { recurring_side?: string } | undefined)?.recurring_side ?? "UNKNOWN",
    enriched: (review?.extraction as { validation?: string } | undefined)?.validation === "OK",
    reviewStatus: (review?.review as { status?: string } | undefined)?.status ?? "UNREVIEWED",
    archived: await isArchived(caseId),
    generatedAt: (review?.extraction as { generated_at?: string } | undefined)?.generated_at ?? "",
    reviewedAt: (review?.review as { reviewed_at?: string } | undefined)?.reviewed_at ?? "",
    stale: await isStale(
      caseId,
      (review?.extraction as { generated_at?: string } | undefined)?.generated_at,
    ),
    summary: summary,
    parties: parties?.parties ?? [],
    claims: claims?.claims ?? [],
    facts: facts?.facts ?? [],
    timeline: timeline?.events ?? [],
    arguments: args?.arguments ?? [],
    reasoning: reasoning?.holdings ?? [],
    issues: issues?.issues ?? [],
    citedLaws: citedLaws?.citations ?? [],
    outcomeDetail: outcome,
    lawRefs: lawRefs?.refs ?? [],
    review: review,
  };
}

export interface LawBlock {
  id: string;
  tipo: string;
  titulo: string;
  fecha_vigencia: string;
  texto: string;
  versions?: Array<{ fecha_vigencia: string; fecha_publicacion: string; texto: string }>;
}

export interface LawNorm {
  boe_id: string;
  titulo: string;
  rango: string;
  ambito: string;
  url_html: string;
  retrieved_at: string;
  notice: string;
  blocks: LawBlock[];
}

// Normas completas de hasta ~6 MB: caché pequeña (3 ≈ 18 MB; las páginas de
// una norma y plazos son las únicas que necesitan el texto entero).
const lawCache = new Map<string, { at: number; norm: LawNorm | null }>();

export async function getLaw(boeId: string): Promise<LawNorm | null> {
  if (!/^BOE-A-[\w-]+$/.test(boeId)) return null;
  const hit = lawCache.get(boeId);
  if (hit && Date.now() - hit.at < 600_000) {
    lawCache.delete(boeId); // refresca el orden: se expulsa la menos usada
    lawCache.set(boeId, hit);
    return hit.norm;
  }
  const norm = await readJson<LawNorm>(path.join(repoRoot(), "laws", "norms", `${boeId}.json`));
  if (lawCache.size >= 3) {
    const masAntigua = lawCache.keys().next().value;
    if (masAntigua !== undefined) lawCache.delete(masAntigua);
  }
  lawCache.set(boeId, { at: Date.now(), norm });
  return norm;
}

export interface BloqueLey {
  id: string;
  tipo: string;
  titulo: string;
  fecha_vigencia: string;
  /** Primeros 150 caracteres del texto, para resúmenes de alertas. */
  resumen: string;
  versions?: Array<{ fecha_vigencia: string; fecha_publicacion: string }>;
}

export interface NormaLigera {
  boe_id: string;
  titulo: string;
  blocks: BloqueLey[];
}

/** Versión SIN el texto de los bloques (el texto son ~6 MB por norma): la
 * usan las comprobaciones de vigencia, que solo necesitan metadatos y un
 * resumen de 150 caracteres. Hasta 64 normas ≈ pocos MB en RAM. */
const bloquesCache = new Map<string, { at: number; norm: NormaLigera | null }>();

export async function getLawBloques(boeId: string): Promise<NormaLigera | null> {
  if (!/^BOE-A-[\w-]+$/.test(boeId)) return null;
  const hit = bloquesCache.get(boeId);
  if (hit && Date.now() - hit.at < 600_000) {
    bloquesCache.delete(boeId);
    bloquesCache.set(boeId, hit);
    return hit.norm;
  }
  const full = await readJson<LawNorm>(path.join(repoRoot(), "laws", "norms", `${boeId}.json`));
  const norm: NormaLigera | null = full
    ? {
        boe_id: full.boe_id,
        titulo: full.titulo,
        blocks: full.blocks.map((block) => ({
          id: block.id,
          tipo: block.tipo,
          titulo: block.titulo,
          fecha_vigencia: block.fecha_vigencia,
          resumen: block.texto.replace(/\s+/g, " ").slice(0, 150),
          versions: block.versions?.map((version) => ({
            fecha_vigencia: version.fecha_vigencia,
            fecha_publicacion: version.fecha_publicacion,
          })),
        })),
      }
    : null;
  while (bloquesCache.size >= 64) {
    const masAntigua = bloquesCache.keys().next().value;
    if (masAntigua === undefined) break;
    bloquesCache.delete(masAntigua);
  }
  bloquesCache.set(boeId, { at: Date.now(), norm });
  return norm;
}
