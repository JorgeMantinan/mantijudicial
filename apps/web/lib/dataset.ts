import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  boeIdsInText,
  detectOutcomeFromText,
  detectSiglasInText,
  falloSection,
  type GoldenEntry,
} from "@pipeline/eval";
import { matchWithCorpus } from "@pipeline/sentencias";
import { aggregate, normalizeKey, type CaseSignals } from "@pipeline/patterns";
import { buildIndex, search, type SearchDoc, type SearchHit } from "@pipeline/search";

const INDEX_TTL_MS = 30_000;

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
  } catch {
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
}

async function isStale(caseId: string, generatedAt: string | undefined): Promise<boolean> {
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

export interface CaseDetail extends CaseListItem {
  summary: Record<string, unknown> | null;
  parties: unknown[];
  claims: unknown[];
  facts: unknown[];
  timeline: unknown[];
  arguments: unknown[];
  reasoning: unknown[];
  issues: unknown[];
  citedLaws: unknown[];
  outcomeDetail: Record<string, unknown> | null;
  lawRefs: unknown[];
  review: Record<string, unknown> | null;
}

async function caseNames(): Promise<string[]> {
  const dir = path.join(repoRoot(), "cases");
  const entries = await fs.readdir(dir);
  return entries.filter((name) => name.startsWith("case_")).sort();
}

export async function section<T>(caseId: string, file: string): Promise<T | null> {
  return readJson<T>(path.join(repoRoot(), "cases", caseId, "structured", file));
}

function archivedFlagPath(caseId: string): string {
  return path.join(repoRoot(), "cases", caseId, "archived.flag");
}

/** ¿Está archivado el caso? (marcador en cases/<id>/archived.flag). */
export async function isArchived(caseId: string): Promise<boolean> {
  return fs
    .access(archivedFlagPath(caseId))
    .then(() => true)
    .catch(() => false);
}

export async function setArchived(caseId: string, archived: boolean): Promise<void> {
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
    });
  }
  todosCache = { value: items, at: Date.now() };
  return items;
}

export async function getCase(caseId: string): Promise<CaseDetail | null> {
  const [summary, classification, outcome, parties, claims, facts, timeline, args, reasoning, issues, citedLaws, lawRefs, review] =
    await Promise.all([
      section<Record<string, unknown>>(caseId, "summary.json"),
      section<{ classification?: Record<string, unknown> }>(caseId, "classification.json"),
      section<Record<string, unknown>>(caseId, "outcome.json"),
      section<{ parties?: unknown[] }>(caseId, "parties.json"),
      section<{ claims?: unknown[] }>(caseId, "claims.json"),
      section<{ facts?: unknown[] }>(caseId, "facts.json"),
      section<{ events?: unknown[] }>(caseId, "timeline.json"),
      section<{ arguments?: unknown[] }>(caseId, "arguments.json"),
      section<{ holdings?: unknown[] }>(caseId, "reasoning.json"),
      section<{ issues?: unknown[] }>(caseId, "issues.json"),
      section<{ citations?: unknown[] }>(caseId, "cited_laws.json"),
      section<{ refs?: unknown[] }>(caseId, "law_refs.json"),
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

export async function getLaw(boeId: string): Promise<LawNorm | null> {
  if (!/^BOE-A-[\w-]+$/.test(boeId)) return null;
  return readJson<LawNorm>(path.join(repoRoot(), "laws", "norms", `${boeId}.json`));
}

export async function getPatterns(): Promise<Record<string, unknown> | null> {
  return readJson<Record<string, unknown>>(path.join(repoRoot(), "cases", "patterns.json"));
}

export async function getEvalReport(): Promise<Record<string, unknown> | null> {
  return readJson<Record<string, unknown>>(path.join(repoRoot(), "cases", "eval_report.json"));
}

export interface ViasArgument {
  argumento: string;
  apoyo_case_id: string;
  apoyo_frase: string;
  ley: string;
}

export interface Vias {
  id: string;
  titulo: string;
  estrategia: string;
  fuerza: "ALTA" | "MEDIA" | "BAJA";
  argumentos: ViasArgument[];
  evidencia_a_solicitar: string[];
  riesgos: string[];
}

export interface ViasOutput {
  case_id: string;
  analysis: {
    model?: string;
    prompt_version?: string;
    generated_at?: string;
    similar_case_ids?: string[];
    law_ids?: string[];
    cost?: number;
    validation?: string;
  };
  report: {
    vias: Vias[];
    huecos: Array<{ descripcion: string; como_cubrirlo: string }>;
    consultas_al_cliente: string[];
    leyes_relevantes: Array<{ boe_id: string; article: string; por_que: string }>;
    avisos: string[];
  };
}

export async function getVias(caseId: string): Promise<ViasOutput | null> {
  if (!/^case_\d{6}$/.test(caseId)) return null;
  return readJson<ViasOutput>(path.join(repoRoot(), "cases", caseId, "structured", "vias.json"));
}

export interface EscritoBlock {
  titulo: string;
  texto: string;
}

export interface EscritoReport {
  case_id: string;
  tipo: string;
  asunto: string;
  encabezado?: { tribunal?: string; numero_recurso?: string; procurador?: string; letrado?: string };
  cuerpo: EscritoBlock[];
  pedidos?: string[];
  citas?: Array<{ texto: string; fuente: string }>;
  comprobar_antes?: string[];
  avisos?: string[];
}

export interface EscritoFile {
  case_id: string;
  analysis?: {
    provider?: string;
    model?: string;
    prompt_version?: string;
    generated_at?: string;
    cost?: number;
    attempts?: number;
    leyes?: string[];
    similares?: string[];
  };
  report: EscritoReport;
}

export async function getEscrito(caseId: string): Promise<EscritoFile | null> {
  if (!/^case_\d{6}$/.test(caseId)) return null;
  return readJson<EscritoFile>(path.join(repoRoot(), "cases", caseId, "structured", "escrito.json"));
}

export interface Comparison {
  otro_caso: string;
  generated_at?: string;
  analysis?: { model?: string; cost?: number };
  report: Record<string, unknown>;
}

export async function getComparisons(caseId: string): Promise<Comparison[]> {
  if (!/^case_\d{6}$/.test(caseId)) return [];
  const dir = path.join(repoRoot(), "cases", caseId, "structured");
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out: Comparison[] = [];
  for (const name of names) {
    if (!/^compare_case_\d{6}\.json$/.test(name)) continue;
    const item = await readJson<Comparison>(path.join(dir, name));
    if (item?.report) out.push(item);
  }
  return out.sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)));
}

export interface GoldenEvidence {
  pdf: { fallo: string; outcome: string; siglas: string[]; boe_ids: string[]; sin_texto: boolean };
  ia: {
    outcome: string;
    branch: string;
    headline: string;
    holdings: number;
    facts: number;
    verified_boe_ids: string[];
  };
}

export interface GoldenInfo {
  entry: GoldenEntry | null;
  evidence: GoldenEvidence;
}

export async function getGoldenInfo(caseId: string): Promise<GoldenInfo | null> {
  if (!/^case_\d{6}$/.test(caseId)) return null;
  const dir = path.join(repoRoot(), "cases", caseId, "structured");
  const text = await fs
    .readFile(path.join(repoRoot(), "cases", caseId, "extracted", "judgment.txt"), "utf8")
    .catch(() => "");
  const [summary, classification, outcome, facts, reasoning, lawRefs, golden] = await Promise.all([
    section<{ summary?: { headline?: string } }>(caseId, "summary.json"),
    section<{ classification?: { civil_branch?: string } }>(caseId, "classification.json"),
    section<{ outcome?: { cassation_outcome?: string } }>(caseId, "outcome.json"),
    section<{ facts?: unknown[] }>(caseId, "facts.json"),
    section<{ holdings?: unknown[] }>(caseId, "reasoning.json"),
    section<{ refs?: Array<{ status?: string; boe_id?: string | null }> }>(caseId, "law_refs.json"),
    readJson<{ entries?: GoldenEntry[] }>(path.join(repoRoot(), "cases", "golden.json")),
  ]);

  const evidence: GoldenEvidence = {
    pdf: {
      fallo: text ? falloSection(text).replace(/\s+/g, " ").slice(0, 500) : "",
      outcome: text ? detectOutcomeFromText(text) : "UNKNOWN",
      siglas: text ? detectSiglasInText(text) : [],
      boe_ids: text ? boeIdsInText(text) : [],
      sin_texto: text.length === 0,
    },
    ia: {
      outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
      branch: classification?.classification?.civil_branch ?? "UNKNOWN",
      headline: summary?.summary?.headline ?? "",
      holdings: reasoning?.holdings?.length ?? 0,
      facts: facts?.facts?.length ?? 0,
      verified_boe_ids: [
        ...new Set(
          (lawRefs?.refs ?? [])
            .filter((ref) => ref.status === "VERIFIED" && ref.boe_id)
            .map((ref) => ref.boe_id as string),
        ),
      ],
    },
  };
  const entry = golden?.entries?.find((item) => item.caseId === caseId) ?? null;
  return { entry, evidence };
}

export interface VigenciaCheck {
  boe_id: string;
  norma: string;
  block_id: string;
  article: number;
  titulo: string;
  fecha_sentencia: string | null;
  version_en_sentencia: string | null;
  version_actual: string;
  cambio_posterior: boolean;
}

/** ¿Ha cambiado el artículo citado DESPUÉS de la fecha de la sentencia? */
export async function getVigenciaChecks(caseId: string): Promise<VigenciaCheck[]> {
  const [meta, lawRefs] = await Promise.all([
    readFirstJson<{ resolution_date?: string }>(path.join(repoRoot(), "cases", caseId, "metadata")),
    section<{ refs?: Array<{ status?: string; boe_id?: string | null; norma?: string; articles?: Array<{ number?: number; block_id?: string | null }> }> }>(
      caseId,
      "law_refs.json",
    ),
  ]);
  const fecha = meta?.resolution_date && /^\d{4}-\d{2}-\d{2}$/.test(meta.resolution_date)
    ? meta.resolution_date.replace(/-/g, "")
    : null;

  const out: VigenciaCheck[] = [];
  for (const ref of lawRefs?.refs ?? []) {
    if (ref.status !== "VERIFIED" || !ref.boe_id) continue;
    const norm = await getLaw(ref.boe_id);
    if (!norm) continue;
    for (const article of ref.articles ?? []) {
      if (!article.block_id || typeof article.number !== "number") continue;
      const block = norm.blocks.find((item) => item.id === article.block_id);
      if (!block) continue;
      const versions = block.versions ?? [];
      const aplicable = fecha
        ? [...versions]
            .filter((version) => version.fecha_vigencia && version.fecha_vigencia <= fecha)
            .sort((a, b) => a.fecha_vigencia.localeCompare(b.fecha_vigencia))
            .pop() ?? null
        : null;
      out.push({
        boe_id: ref.boe_id,
        norma: ref.norma ?? "",
        block_id: block.id,
        article: article.number,
        titulo: block.titulo,
        fecha_sentencia: fecha ?? null,
        version_en_sentencia: aplicable?.fecha_vigencia ?? null,
        version_actual: block.fecha_vigencia,
        cambio_posterior: Boolean(fecha && block.fecha_vigencia > fecha),
      });
    }
  }
  return out;
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

export interface VigenciaAlertCaso {
  caseId: string;
  headline: string;
  fecha_sentencia: string | null;
  version_en_sentencia: string | null;
}

export interface VigenciaAlert {
  boe_id: string;
  norma: string;
  block_id: string;
  article: number;
  titulo: string;
  version_actual: string;
  casos: VigenciaAlertCaso[];
}

let vigenciaAlerts: { value: VigenciaAlert[]; at: number } | null = null;
const VIGENCIA_ALERT_TTL_MS = 60_000;

/**
 * Artículos citados por tus casos cuya versión vigente del BOE es POSTERIOR
 * a la fecha de la sentencia: la ley cambió después de que el tribunal
 * resolviera y quien se apoye en esa cita debe mirar la versión actual.
 */
export async function getVigenciaAlerts(): Promise<VigenciaAlert[]> {
  if (vigenciaAlerts && Date.now() - vigenciaAlerts.at < VIGENCIA_ALERT_TTL_MS) {
    return vigenciaAlerts.value;
  }
  const cases = await listCases();
  const headlines = new Map(cases.map((item) => [item.id, item.headline]));
  const normCache = new Map<string, LawNorm | null>();
  const groups = new Map<string, VigenciaAlert>();

  for (const item of cases) {
    const [meta, refs] = await Promise.all([
      readFirstJson<{ resolution_date?: string }>(
        path.join(repoRoot(), "cases", item.id, "metadata"),
      ),
      section<{
        refs?: Array<{
          status?: string;
          boe_id?: string | null;
          norma?: string;
          articles?: Array<{ number?: number; block_id?: string | null }>;
        }>;
      }>(item.id, "law_refs.json"),
    ]);
    const raw = meta?.resolution_date ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) continue;
    const fecha = raw.replace(/-/g, "");

    for (const ref of refs?.refs ?? []) {
      if (ref.status !== "VERIFIED" || !ref.boe_id) continue;
      if (!normCache.has(ref.boe_id)) normCache.set(ref.boe_id, await getLaw(ref.boe_id));
      const norm = normCache.get(ref.boe_id);
      if (!norm) continue;

      for (const article of ref.articles ?? []) {
        if (!article.block_id || typeof article.number !== "number") continue;
        const block = norm.blocks.find((item2) => item2.id === article.block_id);
        if (!block || !(block.fecha_vigencia > fecha)) continue;

        const key = `${ref.boe_id}|${block.id}`;
        const entry =
          groups.get(key) ??
          ({
            boe_id: ref.boe_id,
            norma: ref.norma ?? "",
            block_id: block.id,
            article: article.number,
            titulo: block.titulo,
            version_actual: block.fecha_vigencia,
            casos: [],
          } satisfies VigenciaAlert);
        if (entry.casos.some((caso) => caso.caseId === item.id)) continue;

        const versionEnSentencia = [...(block.versions ?? [])]
          .filter((version) => version.fecha_vigencia && version.fecha_vigencia <= fecha)
          .sort((a, b) => a.fecha_vigencia.localeCompare(b.fecha_vigencia))
          .pop()?.fecha_vigencia ?? null;

        entry.casos.push({
          caseId: item.id,
          headline: headlines.get(item.id) ?? item.id,
          fecha_sentencia: raw,
          version_en_sentencia: versionEnSentencia,
        });
        groups.set(key, entry);
      }
    }
  }

  const value = [...groups.values()].sort((a, b) => b.casos.length - a.casos.length);
  vigenciaAlerts = { value, at: Date.now() };
  return value;
}

export interface TemaArgumento {
  tipo: string;
  aceptados: number;
  rechazados: number;
  parciales: number;
  sinAnalizar: number;
  total: number;
}

export interface TemaLey {
  norma: string;
  boe_id: string | null;
  veces: number;
}

export interface TemaFicha {
  tema: EvolucionTema;
  argumentos: TemaArgumento[];
  leyes: TemaLey[];
}

/** Ficha de un tema: cronología + argumentos usados + leyes citadas. */
export async function getTema(
  topic: string,
  permitido: (caseId: string) => boolean = () => true,
  filtros: { branch?: string; outcome?: string } = {},
): Promise<TemaFicha | null> {
  const temas = await getEvolucion();
  const base = temas.find((item) => item.topic === topic);
  if (!base) return null;
  const entries = base.entries.filter(
    (entry) =>
      permitido(entry.caseId) &&
      (!filtros.branch || entry.branch === filtros.branch) &&
      (!filtros.outcome || entry.outcome === filtros.outcome),
  );
  if (entries.length === 0) return null;
  const distribution: Record<string, number> = {};
  for (const entry of entries) {
    distribution[entry.outcome] = (distribution[entry.outcome] ?? 0) + 1;
  }
  const fechas = entries.map((entry) => entry.fecha).sort();
  const tema: EvolucionTema = {
    ...base,
    entries,
    cases: entries.length,
    distribution,
    first: fechas[0] ?? base.first,
    last: fechas[fechas.length - 1] ?? base.last,
  };

  const argsMap = new Map<string, TemaArgumento>();
  const leyesMap = new Map<string, TemaLey>();

  for (const entry of tema.entries) {
    const [args, lawRefs] = await Promise.all([
      section<{
        arguments?: Array<{ type?: string; outcome?: string }>;
      }>(entry.caseId, "arguments.json"),
      section<{
        refs?: Array<{ status?: string; boe_id?: string | null; norma?: string }>;
      }>(entry.caseId, "law_refs.json"),
    ]);

    for (const argument of args?.arguments ?? []) {
      const tipo = (argument.type ?? "UNKNOWN").toUpperCase();
      const row =
        argsMap.get(tipo) ??
        ({ tipo, aceptados: 0, rechazados: 0, parciales: 0, sinAnalizar: 0, total: 0 } satisfies TemaArgumento);
      row.total += 1;
      const outcome = (argument.outcome ?? "").toUpperCase();
      if (["ACCEPTED", "ACEPTADO", "ACEPTADA", "ESTIMADO", "ESTIMADA"].includes(outcome)) {
        row.aceptados += 1;
      } else if (["REJECTED", "RECHAZADO", "RECHAZADA", "DESESTIMADO", "DESESTIMADA"].includes(outcome)) {
        row.rechazados += 1;
      } else if (["PARTIALLY_ACCEPTED", "PARCIAL", "PARCIALMENTE"].includes(outcome)) {
        row.parciales += 1;
      } else {
        row.sinAnalizar += 1;
      }
      argsMap.set(tipo, row);
    }

    for (const ref of lawRefs?.refs ?? []) {
      if (ref.status !== "VERIFIED") continue;
      const key = `${ref.norma ?? "?"}|${ref.boe_id ?? ""}`;
      const row = leyesMap.get(key) ?? { norma: ref.norma ?? "?", boe_id: ref.boe_id ?? null, veces: 0 };
      row.veces += 1;
      leyesMap.set(key, row);
    }
  }

  const argumentos = [...argsMap.values()].sort(
    (a, b) => b.aceptados + b.rechazados - (a.aceptados + a.rechazados),
  );
  const leyes = [...leyesMap.values()].sort((a, b) => b.veces - a.veces);
  return { tema, argumentos, leyes };
}

export interface SentenciaEnCorpus {
  raw: string;
  roj: string;
  tipo: "STS" | "ATS" | "SENTENCIA";
  enCorpus: boolean;
  caseId: string | null;
  ecli: string | null;
}

/** Sentencias que este caso cita y que (tal vez) ya tienes en el corpus. */
export async function getSentenciasCitadas(caseId: string): Promise<SentenciaEnCorpus[]> {
  const text = await fs
    .readFile(path.join(repoRoot(), "cases", caseId, "extracted", "judgment.txt"), "utf8")
    .catch(() => "");
  if (!text) return [];
  const manifest = await readJson<{
    entries?: Array<{ caseDir: string; pdf: { roj: string | null; ecli: string | null } }>;
  }>(path.join(repoRoot(), "cases", "manifest.json"));
  const corpus = (manifest?.entries ?? []).map((entry) => ({
    caseDir: entry.caseDir,
    roj: entry.pdf.roj,
    ecli: entry.pdf.ecli,
  }));
  const own = corpus.find((entry) => entry.caseDir === caseId)?.roj ?? null;
  return matchWithCorpus(text, corpus)
    .filter((item) => item.roj !== own)
    .map((item) => ({
      raw: item.raw,
      roj: item.roj,
      tipo: item.tipo,
      enCorpus: item.enCorpus,
      caseId: item.caseId,
      ecli: item.ecli,
    }));
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
export async function getEvolucion(): Promise<EvolucionTema[]> {
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

  return [...groups.entries()]
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
}

export interface Contradiccion {
  topic: string;
  cases: number;
  estimados: number;
  desestimados: number;
  parciales: number;
  ejemplos: Array<{ caseId: string; headline: string; outcome: string; frase: string }>;
}

/**
 * Temas donde el TS se ha pronunciado en sentidos opuestos: base para la
 * alerta de "criterio dividido" (asociación, no causalidad).
 */
export async function getContradicciones(minPorLado = 3): Promise<Contradiccion[]> {
  const temas = await getEvolucion();
  return temas
    .map((tema) => {
      const estimados = tema.distribution.ESTIMED ?? 0;
      const desestimados = tema.distribution.DISMISSED ?? 0;
      const parciales = tema.distribution.PARTIALLY_ESTIMATED ?? 0;
      const ejemplos = [
        ...tema.entries.filter((entry) => entry.outcome === "ESTIMED").slice(0, 2),
        ...tema.entries.filter((entry) => entry.outcome === "DISMISSED").slice(0, 2),
      ];
      return {
        topic: tema.topic,
        cases: tema.cases,
        estimados,
        desestimados,
        parciales,
        ejemplos: ejemplos.map((entry) => ({
          caseId: entry.caseId,
          headline: entry.headline,
          outcome: entry.outcome,
          frase: entry.frase,
        })),
      };
    })
    .filter(
      (item) => item.estimados >= minPorLado && item.desestimados >= minPorLado,
    )
    .sort((a, b) => b.estimados + b.desestimados - (a.estimados + a.desestimados));
}

export async function getCaseCitations(): Promise<Record<string, unknown> | null> {
  return readJson<Record<string, unknown>>(path.join(repoRoot(), "laws", "case_citations.json"));
}

export interface LawUsage {
  byNorm: Array<{ boe_id: string; titulo: string; citations: number; cases: string[] }>;
  byArticle: Array<{ boe_id: string; article: number; titulo: string; citations: number; cases: string[] }>;
}

interface RefLite {
  boe_id?: string | null;
  status?: string;
  norma?: string;
  articles?: Array<{ number?: number; titulo?: string | null }>;
}

export async function getLawUsage(caseIds: string[]): Promise<LawUsage> {
  const norms = new Map<string, { titulo: string; citations: number; cases: Set<string> }>();
  const articles = new Map<
    string,
    { boe_id: string; article: number; titulo: string; citations: number; cases: Set<string> }
  >();
  const titles = new Map((await listLaws()).map((law) => [law.boe_id, law.titulo]));

  for (const caseId of caseIds) {
    const refs = await section<{ refs?: RefLite[] }>(caseId, "law_refs.json");
    for (const ref of refs?.refs ?? []) {
      if (ref.status !== "VERIFIED" || !ref.boe_id) continue;
      const entry =
        norms.get(ref.boe_id) ??
        { titulo: titles.get(ref.boe_id) ?? ref.boe_id, citations: 0, cases: new Set<string>() };
      entry.citations += 1;
      entry.cases.add(caseId);
      norms.set(ref.boe_id, entry);

      for (const article of ref.articles ?? []) {
        if (typeof article.number !== "number") continue;
        if (article.titulo === null || article.titulo === undefined) continue;
        const key = `${ref.boe_id}#${article.number}`;
        const item =
          articles.get(key) ??
          {
            boe_id: ref.boe_id,
            article: article.number,
            titulo: article.titulo ?? "",
            citations: 0,
            cases: new Set<string>(),
          };
        item.citations += 1;
        item.cases.add(caseId);
        articles.set(key, item);
      }
    }
  }

  return {
    byNorm: [...norms.entries()]
      .map(([boe_id, entry]) => ({
        boe_id,
        titulo: entry.titulo,
        citations: entry.citations,
        cases: [...entry.cases].sort(),
      }))
      .sort((a, b) => b.citations - a.citations),
    byArticle: [...articles.values()]
      .map((item) => ({ ...item, cases: [...item.cases].sort() }))
      .sort((a, b) => b.citations - a.citations),
  };
}

async function loadSignals(caseId: string): Promise<CaseSignals | null> {
  const review = await section<{ extraction?: { validation?: string } }>(caseId, "review.json");
  if (review?.extraction?.validation !== "OK") return null;
  const [classification, outcome, claims, args, reasoning, issues, lawRefs] = await Promise.all([
    section<{ classification?: { civil_branch?: string; subtopic?: string } }>(caseId, "classification.json"),
    section<{ outcome?: { cassation_outcome?: string; recurring_side?: string } }>(caseId, "outcome.json"),
    section<{ claims?: Array<{ outcome?: string; outcome_scope?: string }> }>(caseId, "claims.json"),
    section<{ arguments?: Array<{ type?: string; side?: string; outcome?: string }> }>(caseId, "arguments.json"),
    section<{ holdings?: Array<{ topic?: string; doctrine?: string }> }>(caseId, "reasoning.json"),
    section<{ issues?: Array<{ topic?: string }> }>(caseId, "issues.json"),
    section<{ refs?: RefLite[] }>(caseId, "law_refs.json"),
  ]);
  if (!outcome?.outcome?.cassation_outcome) return null;

  return {
    caseId,
    branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    subtopic: classification?.classification?.subtopic ?? "",
    cassation: outcome.outcome.cassation_outcome,
    recurringSide: outcome.outcome.recurring_side ?? "UNKNOWN",
    claims: (claims?.claims ?? []).map((claim) => ({
      outcome: claim.outcome ?? "UNKNOWN",
      scope: claim.outcome_scope ?? "NONE",
    })),
    args: (args?.arguments ?? []).map((argument) => ({
      type: argument.type ?? "UNKNOWN",
      side: argument.side ?? "UNKNOWN",
      outcome: argument.outcome ?? "UNKNOWN",
    })),
    holdings: (reasoning?.holdings ?? []).map((holding) => ({
      topic: holding.topic ?? "",
      doctrine: holding.doctrine ?? "UNKNOWN",
    })),
    issues: (issues?.issues ?? []).map((issue) => ({ topic: issue.topic ?? "" })),
    laws: (lawRefs?.refs ?? []).map((ref) => ({
      boe_id: ref.boe_id ?? null,
      sigla: ref.norma ?? "",
      status: ref.status ?? "UNKNOWN",
    })),
  };
}

export async function computePatterns(
  caseIds: string[],
  minSupport = 5,
): Promise<ReturnType<typeof aggregate> | null> {
  const signals = await Promise.all(caseIds.map((caseId) => loadSignals(caseId)));
  const valid = signals.filter((item): item is CaseSignals => item !== null);
  if (valid.length === 0) return null;
  return aggregate(valid, minSupport);
}

export interface ReviewStats {
  total: number;
  enriched: number;
  byStatus: Record<string, number>;
  pending: CaseListItem[];
  next: CaseListItem | null;
  cachedAt: number;
}

let reviewStats: { value: ReviewStats; at: number } | null = null;

const REVIEW_TTL_MS = 15_000;

export async function getReviewStats(force = false): Promise<ReviewStats> {
  if (!force && reviewStats && Date.now() - reviewStats.at < REVIEW_TTL_MS) return reviewStats.value;
  const all = await listCases();
  const byStatus: Record<string, number> = {};
  for (const item of all) byStatus[item.reviewStatus] = (byStatus[item.reviewStatus] ?? 0) + 1;
  const pending = all
    .filter((item) => item.enriched && item.reviewStatus === "UNREVIEWED")
    .sort((a, b) => a.id.localeCompare(b.id));
  const value: ReviewStats = {
    total: all.length,
    enriched: all.filter((item) => item.enriched).length,
    byStatus,
    pending,
    next: pending[0] ?? null,
    cachedAt: Date.now(),
  };
  reviewStats = { value, at: Date.now() };
  return value;
}

export interface OutcomeTotals {
  total: number;
  enriched: number;
  byBranch: Array<{ branch: string; count: number }>;
  byOutcome: Array<{ outcome: string; count: number }>;
}

export async function getDashboard(): Promise<OutcomeTotals> {
  const cases = await listCases();
  const branches = new Map<string, number>();
  const outcomes = new Map<string, number>();
  for (const item of cases) {
    branches.set(item.branch, (branches.get(item.branch) ?? 0) + 1);
    outcomes.set(item.outcome, (outcomes.get(item.outcome) ?? 0) + 1);
  }
  return {
    total: cases.length,
    enriched: cases.filter((item) => item.enriched).length,
    byBranch: [...branches.entries()]
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count),
    byOutcome: [...outcomes.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => b.count - a.count),
  };
}

let searchDocs: { docs: SearchDoc[]; index: ReturnType<typeof buildIndex>; at: number } | null = null;
async function getIndex(): Promise<{ docs: SearchDoc[]; index: ReturnType<typeof buildIndex> }> {
  if (searchDocs && Date.now() - searchDocs.at < INDEX_TTL_MS) {
    return { docs: searchDocs.docs, index: searchDocs.index };
  }
  const [caseDocs, articleDocs] = await Promise.all([loadCaseDocs(), loadArticleDocs()]);
  const docs = [...caseDocs, ...articleDocs];
  searchDocs = { docs, index: buildIndex(docs), at: Date.now() };
  return { docs, index: searchDocs.index };
}

export async function runSearch(
  query: string,
  options: {
    kinds?: string[];
    limit?: number;
    filters?: Record<string, string>;
    allow?: (doc: SearchDoc) => boolean;
  } = {},
): Promise<{ hits: SearchHit[]; docs: number }> {
  const { docs, index } = await getIndex();
  const hits = search(index, query, {
    kinds: options.kinds,
    limit: options.limit ?? 15,
    filters: options.filters,
    allow: options.allow,
  });
  return { hits, docs: docs.length };
}

export interface SimilarCase {
  id: string;
  title: string;
  score: number;
  branch: string;
  outcome: string;
  why: string[];
}

export async function getSimilarCases(caseId: string, limit = 5): Promise<SimilarCase[]> {
  const detail = await getCase(caseId);
  if (!detail) return [];

  const topics = (detail.reasoning as Array<{ topic?: string; doctrine?: string }>)
    .flatMap((holding) => [holding.topic, holding.doctrine])
    .filter((value): value is string => Boolean(value && value !== "UNKNOWN"));
  const query = [detail.headline, detail.subtopic, ...topics].join(" ");

  const { index } = await getIndex();
  const hits = search(index, query, { kinds: ["case"], limit: limit + 6 });
  const ownLaws = new Set(
    (detail.lawRefs as Array<{ boe_id?: string | null; norma?: string }>)
      .map((ref) => ref.boe_id)
      .filter((value): value is string => Boolean(value)),
  );
  const ownTerms = new Set(
    topics.map((value) => value.toLowerCase()).concat(detail.branch.toLowerCase()),
  );

  const results: SimilarCase[] = [];
  for (const hit of hits) {
    if (hit.id === caseId) continue;
    const sharedTerms = hit.matchedTerms.filter((term) => ownTerms.has(term));
    const sharedLaws = ((hit.meta as { laws?: string }).laws ?? "")
      .split(",")
      .filter((value) => value && ownLaws.has(value));
    const why: string[] = [];
    if (sharedTerms.length > 0) why.push(`temas compartidos: ${sharedTerms.join(", ")}`);
    if (hit.phraseMatch) why.push("coincidencia de frase literal");
    if (sharedLaws.length > 0) why.push(`mismas normas: ${sharedLaws.join(", ")}`);
    if (sharedTerms.length === 0 && !hit.phraseMatch && sharedLaws.length === 0) {
      why.push(`términos coincidentes: ${hit.matchedTerms.slice(0, 6).join(", ")}`);
    }
    results.push({
      id: hit.id,
      title: hit.title,
      score: hit.score,
      branch: String(hit.meta.branch ?? ""),
      outcome: String(hit.meta.outcome ?? ""),
      why,
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function loadCaseDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const names = await caseNames();
  for (const name of names) {
    const review = await section<{ extraction?: { validation?: string } }>(name, "review.json");
    if (review?.extraction?.validation !== "OK") continue;
    const summary = await section<{
      summary?: { headline?: string; summary?: string; key_points?: string[] };
    }>(name, "summary.json");
    const classification = await section<{
      classification?: { civil_branch?: string; subtopic?: string };
    }>(name, "classification.json");
    const outcome = await section<{
      outcome?: { cassation_outcome?: string; recurring_side?: string; reasoning_summary?: string };
    }>(name, "outcome.json");
    const issues = await section<{ issues?: Array<{ topic?: string; description?: string }> }>(name, "issues.json");
    const facts = await section<{ facts?: Array<{ description?: string }> }>(name, "facts.json");
    const argumentsFile = await section<{
      arguments?: Array<{ description?: string; legal_basis?: string }>;
    }>(name, "arguments.json");
    const reasoning = await section<{
      holdings?: Array<{
        holding_id?: string;
        statement?: string;
        topic?: string;
        doctrine?: string;
        importance?: number;
      }>;
    }>(name, "reasoning.json");
    const citedLaws = await section<{
      citations?: Array<{ raw_text?: string; norma?: string; article?: string }>;
    }>(name, "cited_laws.json");
    const parties = await section<{ parties?: Array<{ name?: string }> }>(name, "parties.json");
    const lawRefs = await section<{ refs?: Array<{ boe_id?: string | null }> }>(name, "law_refs.json");
    const lawIds = (lawRefs?.refs ?? [])
      .map((ref) => ref.boe_id)
      .filter((value): value is string => Boolean(value))
      .join(",");

    const meta = {
      branch: classification?.classification?.civil_branch ?? "UNKNOWN",
      outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
      case: name,
      laws: lawIds,
    };
    const parts = [
      summary?.summary?.summary,
      ...(summary?.summary?.key_points ?? []),
      outcome?.outcome?.reasoning_summary,
      ...(issues?.issues ?? []).flatMap((issue) => [issue.topic, issue.description]),
      ...(facts?.facts ?? []).map((fact) => fact.description),
      ...(argumentsFile?.arguments ?? []).flatMap((argument) => [argument.description, argument.legal_basis]),
      ...(citedLaws?.citations ?? []).flatMap((citation) => [citation.raw_text, citation.norma]),
      ...(parties?.parties ?? []).map((party) => party.name),
    ].filter((value): value is string => Boolean(value && value.trim()));

    docs.push({
      id: name,
      kind: "case",
      title: summary?.summary?.headline ?? classification?.classification?.subtopic ?? name,
      body: parts.join("\n"),
      meta,
    });

    for (const holding of reasoning?.holdings ?? []) {
      if (!holding.statement) continue;
      docs.push({
        id: `${name}#${holding.holding_id ?? "HOLD"}`,
        kind: "holding",
        title: holding.topic ?? holding.statement.slice(0, 80),
        body: `${holding.statement}\n${holding.doctrine ?? ""}`,
        meta: { ...meta, importance: String(holding.importance ?? 3) },
      });
    }
  }
  return docs;
}

async function loadArticleDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const norms = await listLaws();
  for (const entry of norms) {
    const norm = await getLaw(entry.boe_id);
    if (!norm) continue;
    for (const block of norm.blocks) {
      if (!block.texto) continue;
      docs.push({
        id: `${norm.boe_id}#${block.id}`,
        kind: "article",
        title: `${block.titulo || block.id} · ${norm.boe_id}`,
        body: `${norm.titulo}\n${block.texto}`,
        meta: { boe_id: norm.boe_id, tipo: block.tipo, titulo: block.titulo },
      });
    }
  }
  return docs;
}



export * from "./dataset-estado";
