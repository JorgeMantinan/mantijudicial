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
import { agruparFrases, type FraseCaso } from "@pipeline/frases";
import type { CompareReport } from "@pipeline/compare";
import {
  type CaseListItem,
  type EvolucionCaso,
  type EvolucionTema,
  type LawIndexEntry,
  getEvolucion,
  caseNames,
  isArchived,
  isStale,
  listCases,
  listLaws,
  readFirstJson,
  readJson,
  repoRoot,
  section,
  setArchived,
} from "./dataset-base";
export * from "./dataset-base";

const INDEX_TTL_MS = 30_000;


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

// Normas de hasta ~6 MB: caché con TTL para no reparsear en cada petición.
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
  if (lawCache.size >= 8) {
    const masAntigua = lawCache.keys().next().value;
    if (masAntigua !== undefined) lawCache.delete(masAntigua);
  }
  lawCache.set(boeId, { at: Date.now(), norm });
  return norm;
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
  report: CompareReport;
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
  /** Primeras palabras del texto del artículo, para saber de qué trata. */
  resumen: string;
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
            resumen: block.texto.replace(/\s+/g, " ").slice(0, 150),
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

// La clave incluye los caseIds visibles: así dos despachos no comparten caché
// (y si alternan, simplemente se recalcula).
/** Caché por clave (máx. 16 ranuras, expulsión de la menos usada): dos
 * despachos o filtros alternos no se pisan como antes con una sola ranura. */
async function memoPorClave<T>(
  cache: Map<string, { at: number; value: T }>,
  clave: string,
  ttlMs: number,
  cargar: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(clave);
  if (hit && Date.now() - hit.at < ttlMs) {
    cache.delete(clave);
    cache.set(clave, hit);
    return hit.value;
  }
  const value = await cargar();
  while (cache.size >= 16) {
    const vieja = cache.keys().next().value;
    if (vieja === undefined) break;
    cache.delete(vieja);
  }
  cache.set(clave, { at: Date.now(), value });
  return value;
}

const lawUsageCache = new Map<string, { at: number; value: LawUsage }>();

export async function getLawUsage(caseIds: string[]): Promise<LawUsage> {
  const clave = caseIds.join(",");
  return memoPorClave(lawUsageCache, clave, 120_000, () => getLawUsageInterno(caseIds));
}

async function getLawUsageInterno(caseIds: string[]): Promise<LawUsage> {
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

// 8 casos × 8 ficheros: caro; el corpus cambia solo al enriquecer.
const patternsCache = new Map<string, { at: number; value: ReturnType<typeof aggregate> | null }>();

export async function computePatterns(
  caseIds: string[],
  minSupport = 5,
): Promise<ReturnType<typeof aggregate> | null> {
  const clave = `${minSupport}|${caseIds.join(",")}`;
  return memoPorClave(patternsCache, clave, 120_000, async () => {
    const signals = await Promise.all(caseIds.map((caseId) => loadSignals(caseId)));
    const valid = signals.filter((item): item is CaseSignals => item !== null);
    return valid.length === 0 ? null : aggregate(valid, minSupport);
  });
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
let reconstruyendoIndice = false;

async function construirIndice(): Promise<void> {
  const [caseDocs, articleDocs] = await Promise.all([loadCaseDocs(), loadArticleDocs()]);
  const docs = [...caseDocs, ...articleDocs];
  searchDocs = { docs, index: buildIndex(docs), at: Date.now() };
}

/** Reconstruye en segundo plano: quien pide búsqueda mientras tanto se sirve
 * con el índice anterior en lugar de pagar ~3 s (2,5 s bloqueando el event
 * loop) dentro de su propia petición. */
function programarReconstruccion(): void {
  if (reconstruyendoIndice) return;
  reconstruyendoIndice = true;
  setTimeout(() => {
    construirIndice()
      .catch((error) => console.error("No se pudo reconstruir el índice:", error))
      .finally(() => {
        reconstruyendoIndice = false;
      });
  }, 0);
}

/** Precarga del índice al arrancar (instrumentation.ts) para que la primera
 * petición de búsqueda no pague la construcción. */
export function warmSearchIndex(): void {
  if (searchDocs || reconstruyendoIndice) return;
  programarReconstruccion();
}

async function getIndex(): Promise<{ docs: SearchDoc[]; index: ReturnType<typeof buildIndex> }> {
  if (searchDocs && Date.now() - searchDocs.at < INDEX_TTL_MS) {
    return { docs: searchDocs.docs, index: searchDocs.index };
  }
  if (searchDocs) {
    programarReconstruccion();
    return { docs: searchDocs.docs, index: searchDocs.index };
  }
  await construirIndice();
  return { docs: searchDocs!.docs, index: searchDocs!.index };
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

  const topics = detail.reasoning
    .flatMap((holding) => [holding.topic, holding.doctrine])
    .filter((value): value is string => Boolean(value && value !== "UNKNOWN"));
  const query = [detail.headline, detail.subtopic, ...topics].join(" ");

  const { index } = await getIndex();
  const hits = search(index, query, { kinds: ["case"], limit: limit + 6 });
  const ownLaws = new Set(
    detail.lawRefs
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

export interface GrupoFrasesView {
  origen: "Hechos" | "Fundamentos" | "Alegaciones" | "Pretensiones" | "Cronología";
  ejemplo: string;
  total: number;
  homogenea: number;
  distribucion: Record<string, number>;
  instancias: Array<{ instancia: string; demandante: number; demandado: number; parcial: number }>;
  ramas: Record<string, number>;
  casos: Array<{ caseId: string; outcome: string; headline: string }>;
}

let frasesCache: { value: GrupoFrasesView[]; at: number } | null = null;

/**
 * Frases que se repiten en varios casos (hechos y fundamentos) y cómo acabó
 * cada uno. Cache 60 s: lee facts/razonamiento de todos los casos.
 */
export async function getGruposFrases(): Promise<GrupoFrasesView[]> {
  if (frasesCache && Date.now() - frasesCache.at < 60_000) return frasesCache.value;

  const items = await listCases();
  const titulos = new Map(items.map((item) => [item.id, item.headline]));
  const ramas = new Map(items.map((item) => [item.id, item.branch]));

  const hechos: FraseCaso[] = [];
  const fundamentos: FraseCaso[] = [];
  const alegaciones: FraseCaso[] = [];
  const pretensiones: FraseCaso[] = [];
  const cronologia: FraseCaso[] = [];
  const mapaInstancias = new Map<
    string,
    Array<{ instance: string; result: string }>
  >();

  const cortar = (texto: string, destino: FraseCaso[], caseId: string, outcome: string, max: number) => {
    let dentro = 0;
    for (const sentencia of texto.split(/(?<=[.?!])\s+/)) {
      if (dentro >= max) break;
      const limpia = sentencia.replace(/\s+/g, " ").trim();
      if (limpia.length < 25 || limpia.length > 240) continue;
      destino.push({ caseId, outcome, texto: limpia });
      dentro += 1;
    }
  };

  for (const item of items) {
    const [facts, reasoning, argumentos, claims, timeline, outcome] = await Promise.all([
      section<{ facts?: Array<{ description?: string }> }>(item.id, "facts.json"),
      section<{ holdings?: Array<{ statement?: string }> }>(item.id, "reasoning.json"),
      section<{ arguments?: Array<{ description?: string }> }>(item.id, "arguments.json"),
      section<{ claims?: Array<{ description?: string }> }>(item.id, "claims.json"),
      section<{ events?: Array<{ description?: string }> }>(item.id, "timeline.json"),
      section<{ outcome?: { decisions?: Array<{ instance?: string; result?: string }> } }>(
        item.id,
        "outcome.json",
      ),
    ]);
    for (const claim of claims?.claims ?? []) {
      if (claim.description) cortar(claim.description, pretensiones, item.id, item.outcome, 6);
    }
    for (const evento of timeline?.events ?? []) {
      if (evento.description) cortar(evento.description, cronologia, item.id, item.outcome, 5);
    }
    mapaInstancias.set(
      item.id,
      (outcome?.outcome?.decisions ?? [])
        .filter((decision) => decision.instance && decision.result)
        .map((decision) => ({ instance: decision.instance!, result: decision.result! })),
    );
    for (const fact of facts?.facts ?? []) {
      if (fact.description) cortar(fact.description, hechos, item.id, item.outcome, 8);
    }
    for (const holding of reasoning?.holdings ?? []) {
      if (holding.statement) cortar(holding.statement, fundamentos, item.id, item.outcome, 6);
    }
    for (const argumento of argumentos?.arguments ?? []) {
      if (argumento.description) cortar(argumento.description, alegaciones, item.id, item.outcome, 8);
    }
  }

  const agrupar = (
    pool: FraseCaso[],
    origen: GrupoFrasesView["origen"],
  ): GrupoFrasesView[] =>
    agruparFrases(pool, 3, 0.5, 6, 0.7)
      .slice(0, 6)
      .map((grupo) => {
        const porInstancia = new Map<
          string,
          { demandante: number; demandado: number; parcial: number }
        >();
        for (const caso of grupo.casos) {
          for (const decision of mapaInstancias.get(caso.caseId) ?? []) {
            const fila =
              porInstancia.get(decision.instance) ?? { demandante: 0, demandado: 0, parcial: 0 };
            if (decision.result === "FAVOR_PLAINTIFF") fila.demandante += 1;
            else if (decision.result === "FAVOR_DEFENDANT") fila.demandado += 1;
            else if (decision.result === "PARTIAL") fila.parcial += 1;
            porInstancia.set(decision.instance, fila);
          }
        }
        return {
          origen,
          ejemplo: grupo.ejemplo,
          total: grupo.total,
          homogenea: Math.round(grupo.homogenea * 100),
          distribucion: grupo.distribucion,
          instancias: [...porInstancia.entries()].map(([instancia, fila]) => ({
            instancia,
            ...fila,
          })),
          ramas: grupo.casos.reduce<Record<string, number>>((acc, caso) => {
            const rama = ramas.get(caso.caseId) ?? "UNKNOWN";
            acc[rama] = (acc[rama] ?? 0) + 1;
            return acc;
          }, {}),
          casos: grupo.casos.map((caso) => ({
            ...caso,
            headline: titulos.get(caso.caseId) ?? caso.caseId,
          })),
        };
      });

  const value = [
    ...agrupar(hechos, "Hechos"),
    ...agrupar(fundamentos, "Fundamentos"),
    ...agrupar(alegaciones, "Alegaciones"),
    ...agrupar(pretensiones, "Pretensiones"),
    ...agrupar(cronologia, "Cronología"),
  ];
  frasesCache = { value, at: Date.now() };
  return value;
}

export interface DoctrinaCitada {
  ref: string;
  date: string;
  quote: string;
  role: string;
  enCorpus: boolean;
  caseId: string | null;
}

/** Sentencias que las partes citan (con su texto) y si las tienes en el corpus. */
export async function getDoctrinaCitada(caseId: string): Promise<DoctrinaCitada[]> {
  const ficha = await readJson<{
    citations?: Array<{ ref?: string; date?: string; quote?: string; role?: string }>;
  }>(path.join(repoRoot(), "cases", caseId, "structured", "cited_case_law.json"));
  const manifest = await readJson<{
    entries?: Array<{ caseDir: string; pdf: { roj: string | null } }>;
  }>(path.join(repoRoot(), "cases", "manifest.json"));
  const rojos = (manifest?.entries ?? [])
    .map((entry) => ({ caseDir: entry.caseDir, roj: entry.pdf.roj }))
    .filter((entry): entry is { caseDir: string; roj: string } => Boolean(entry.roj));

  const vistas = new Set<string>();
  const out: DoctrinaCitada[] = [];
  for (const cita of ficha?.citations ?? []) {
    const ref = (cita.ref ?? "").trim();
    if (!ref || vistas.has(ref)) continue;
    vistas.add(ref);
    const enCorpus = rojos.find((entry) => ref.includes(entry.roj!));
    out.push({
      ref,
      date: cita.date ?? "",
      quote: (cita.quote ?? "").replace(/\s+/g, " ").slice(0, 180),
      role: cita.role ?? "",
      enCorpus: Boolean(enCorpus),
      caseId: enCorpus?.caseDir ?? null,
    });
    if (out.length >= 12) break;
  }
  return out;
}

export interface ExitoArgumento {
  tipo: string;
  lado: string;
  aceptados: number;
  rechazados: number;
  parciales: number;
  sinAnalizar: number;
  total: number;
  exito: number;
}

let exitoCache: { value: ExitoArgumento[]; at: number } | null = null;

/** Éxito global de cada tipo de argumento y de cada lado (cache 60 s). */
export async function getExitoArgumentos(): Promise<ExitoArgumento[]> {
  if (exitoCache && Date.now() - exitoCache.at < 60_000) return exitoCache.value;

  const mapa = new Map<string, ExitoArgumento>();
  for (const item of await listCases()) {
    const args = await section<{
      arguments?: Array<{ type?: string; side?: string; outcome?: string }>;
    }>(item.id, "arguments.json");
    for (const argumento of args?.arguments ?? []) {
      const tipo = (argumento.type ?? "UNKNOWN").toUpperCase();
      const lado = (argumento.side ?? "UNKNOWN").toUpperCase();
      const key = `${tipo}|${lado}`;
      const fila =
        mapa.get(key) ??
        ({ tipo, lado, aceptados: 0, rechazados: 0, parciales: 0, sinAnalizar: 0, total: 0, exito: 0 } satisfies ExitoArgumento);
      fila.total += 1;
      const outcome = (argumento.outcome ?? "").toUpperCase();
      if (outcome === "ACCEPTED") fila.aceptados += 1;
      else if (outcome === "REJECTED") fila.rechazados += 1;
      else if (outcome === "PARTIALLY_ACCEPTED") fila.parciales += 1;
      else fila.sinAnalizar += 1;
      mapa.set(key, fila);
    }
  }

  const value = [...mapa.values()]
    .map((fila) => ({
      ...fila,
      exito:
        fila.aceptados + fila.rechazados > 0
          ? Math.round((fila.aceptados * 100) / (fila.aceptados + fila.rechazados))
          : 0,
    }))
    .filter((fila) => fila.aceptados + fila.rechazados >= 3)
    .sort((a, b) => b.aceptados + b.rechazados - (a.aceptados + a.rechazados));
  exitoCache = { value, at: Date.now() };
  return value;
}

/** Los grupos globales de frases recontados sobre los casos de un tema. */
export function filtrarFrasesDelTema(
  grupos: GrupoFrasesView[],
  caseIds: Set<string>,
  limite = 5,
): GrupoFrasesView[] {
  return grupos
    .map((grupo) => ({ ...grupo, casos: grupo.casos.filter((caso) => caseIds.has(caso.caseId)) }))
    .map((grupo) => {
      const distribucion: Record<string, number> = {};
      for (const caso of grupo.casos) distribucion[caso.outcome] = (distribucion[caso.outcome] ?? 0) + 1;
      const maximo = grupo.casos.length > 0 ? Math.max(...Object.values(distribucion)) : 0;
      return {
        ...grupo,
        distribucion,
        homogenea: grupo.casos.length > 0 ? Math.round((maximo * 100) / grupo.casos.length) : 0,
        total: grupo.casos.length,
      };
    })
    .filter((grupo) => grupo.total >= 2)
    .sort((a, b) => b.homogenea - a.homogenea || b.total - a.total)
    .slice(0, limite);
}

function orgFile(orgId: string, nombre: string): string {
  const seguro = orgId.replace(/[^\w-]/g, "_").slice(0, 40) || "sin-org";
  return path.join(repoRoot(), "data", "org", seguro, nombre);
}

function patronesVistosPath(orgId: string): string {
  return orgFile(orgId, "patrones_vistos.json");
}

/** Patrones emergentes que ya ha revisado este despacho. */
export async function getPatronesVistos(orgId: string): Promise<string[]> {
  const list = await readJson<string[]>(patronesVistosPath(orgId));
  return Array.isArray(list) ? list : [];
}

export async function marcarPatronVisto(orgId: string, ejemplo: string): Promise<void> {
  const actuales = await getPatronesVistos(orgId);
  if (actuales.includes(ejemplo)) return;
  const siguiente = [...actuales, ejemplo.slice(0, 300)].slice(-200);
  await fs.mkdir(path.dirname(patronesVistosPath(orgId)), { recursive: true });
  await fs.writeFile(patronesVistosPath(orgId), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
}

export async function desmarcarPatrones(orgId: string): Promise<void> {
  await fs.writeFile(patronesVistosPath(orgId), "[]\n", "utf8");
}

function casosOrgPath(): string {
  return path.join(repoRoot(), "data", "casos_org.json");
}

/**
 * Despacho propietario del caso (quien lo subió). Un despacho no tiene
 * derechos sobre los de otro: cada caso queda con la firma de quien lo subió
 * y los demás solo entran por concesión expresa (share grants).
 */
export async function getOrgDelCaso(caseId: string): Promise<string | null> {
  const data = await readJson<Record<string, string>>(casosOrgPath());
  return data?.[caseId] ?? null;
}

export async function setOrgDelCaso(caseId: string, orgId: string): Promise<void> {
  const data = (await readJson<Record<string, string>>(casosOrgPath())) ?? {};
  if (data[caseId] === orgId) return;
  data[caseId] = orgId;
  await fs.mkdir(path.dirname(casosOrgPath()), { recursive: true });
  await fs.writeFile(casosOrgPath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** Mapa caso → despacho propietario (lectura única del fichero). */
export async function getMapaOrgs(): Promise<Record<string, string>> {
  return (await readJson<Record<string, string>>(casosOrgPath())) ?? {};
}

function clientesPath(): string {
  return path.join(repoRoot(), "data", "casos_cliente.json");
}

/** Mapa caso → cliente/encargo (lo rellena el despacho desde la ficha). */
export async function getClientes(): Promise<Record<string, string>> {
  const data = await readJson<Record<string, string>>(clientesPath());
  return data && typeof data === "object" ? data : {};
}

export async function setCliente(caseId: string, cliente: string): Promise<void> {
  const data = await getClientes();
  if (cliente.trim()) data[caseId] = cliente.trim().slice(0, 80);
  else delete data[caseId];
  await fs.mkdir(path.dirname(clientesPath()), { recursive: true });
  await fs.writeFile(clientesPath(), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export interface VistaGuardada {
  nombre: string;
  qs: Record<string, string>;
}

function vistasPath(orgId: string): string {
  return orgFile(orgId, "vistas_guardadas.json");
}

export async function getVistas(orgId: string): Promise<VistaGuardada[]> {
  const list = await readJson<VistaGuardada[]>(vistasPath(orgId));
  return Array.isArray(list) ? list : [];
}

export async function saveVista(orgId: string, vista: VistaGuardada): Promise<VistaGuardada[]> {
  const actuales = await getVistas(orgId);
  const siguiente = [vista, ...actuales.filter((item) => item.nombre !== vista.nombre)].slice(0, 20);
  await fs.mkdir(path.dirname(vistasPath(orgId)), { recursive: true });
  await fs.writeFile(vistasPath(orgId), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
  return siguiente;
}

export async function deleteVista(orgId: string, nombre: string): Promise<VistaGuardada[]> {
  const siguiente = (await getVistas(orgId)).filter((item) => item.nombre !== nombre);
  await fs.writeFile(vistasPath(orgId), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
  return siguiente;
}

export interface EntradaHistorialAlertas {
  fecha: string;
  total: number;
  vigencia: number;
  dividido: number;
  calidad: number;
  emergentes: number;
}

function historialAlertasPath(): string {
  return path.join(repoRoot(), "data", "alertas_historial.json");
}

export async function getHistorialAlertas(): Promise<EntradaHistorialAlertas[]> {
  const list = await readJson<EntradaHistorialAlertas[]>(historialAlertasPath());
  return Array.isArray(list) ? list : [];
}

/** Guarda el snapshot del día (solo uno por día; conserva 180). */
export async function registrarAlertasDelDia(
  entrada: EntradaHistorialAlertas,
): Promise<EntradaHistorialAlertas[]> {
  const historial = await getHistorialAlertas();
  const ultimo = historial[historial.length - 1];
  if (ultimo?.fecha === entrada.fecha) return historial;
  const siguiente = [...historial, entrada].slice(-180);
  await fs.mkdir(path.dirname(historialAlertasPath()), { recursive: true });
  await fs.writeFile(historialAlertasPath(), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
  return siguiente;
}

/** Días desde la última revisión (o desde el análisis si no se ha revisado). */
export function diasSinTocar(item: Pick<CaseListItem, "reviewedAt" | "generatedAt">): number {
  const ultima = (item.reviewedAt || item.generatedAt || "").slice(0, 10);
  if (!ultima) return 9999;
  const tiempo = Date.parse(ultima);
  if (Number.isNaN(tiempo)) return 9999;
  return Math.max(0, Math.floor((Date.now() - tiempo) / 86_400_000));
}

export interface Duplicado {
  campo: "ROJ" | "ECLI";
  valor: string;
  casos: string[];
}

/** Mismo ROJ o ECLI en más de un caso: posible PDF repetido en el corpus. */
export async function getDuplicados(): Promise<Duplicado[]> {
  const manifest = await readJson<{
    entries?: Array<{ caseDir: string; pdf: { roj: string | null; ecli: string | null } }>;
  }>(path.join(repoRoot(), "cases", "manifest.json"));

  const porRojo = new Map<string, string[]>();
  const porEcli = new Map<string, string[]>();
  for (const entry of manifest?.entries ?? []) {
    if (entry.pdf.roj) porRojo.set(entry.pdf.roj, [...(porRojo.get(entry.pdf.roj) ?? []), entry.caseDir]);
    if (entry.pdf.ecli && entry.pdf.ecli !== "UNKNOWN") {
      porEcli.set(entry.pdf.ecli, [...(porEcli.get(entry.pdf.ecli) ?? []), entry.caseDir]);
    }
  }

  const out: Duplicado[] = [];
  for (const [valor, casos] of porRojo) {
    if (casos.length > 1) out.push({ campo: "ROJ", valor, casos });
  }
  for (const [valor, casos] of porEcli) {
    if (casos.length > 1 && !out.some((item) => item.campo === "ROJ" && item.valor.includes(valor))) {
      out.push({ campo: "ECLI", valor, casos });
    }
  }
  return out.slice(0, 10);
}

export interface Recomendaciones {
  frases: GrupoFrasesView[];
  argumentos: Array<{ caseId: string; type: string; description: string }>;
  leyes: Array<{
    norma: string;
    boe_id: string;
    block_id: string | null;
    article: number;
    casos: number;
  }>;
}

/**
 * Qué ha funcionado en los casos parecidos: frases homogéneas que aparecen en
 * ellos, argumentos aceptados y leyes verificadas citadas. Gratis (solo JSON).
 */
export async function getRecomendaciones(
  caseId: string,
  similares: string[],
): Promise<Recomendaciones> {
  const conjunto = new Set([caseId, ...similares]);
  const frases = filtrarFrasesDelTema(await getGruposFrases(), conjunto, 12);

  const argumentos: Recomendaciones["argumentos"] = [];
  const leyesMap = new Map<string, Recomendaciones["leyes"][number]>();

  for (const id of similares.slice(0, 6)) {
    const [args, refs] = await Promise.all([
      section<{
        arguments?: Array<{
          type?: string;
          outcome?: string;
          description?: string;
          importance?: number;
        }>;
      }>(id, "arguments.json"),
      section<{
        refs?: Array<{
          status?: string;
          boe_id?: string | null;
          norma?: string;
          articles?: Array<{ number?: number; block_id?: string | null }>;
        }>;
      }>(id, "law_refs.json"),
    ]);

    const aceptados = (args?.arguments ?? [])
      .filter((argumento) => (argumento.outcome ?? "").toUpperCase() === "ACCEPTED")
      .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
    for (const argumento of aceptados) {
      if (argumentos.length >= 12) break;
      argumentos.push({
        caseId: id,
        type: (argumento.type ?? "").toUpperCase(),
        description: (argumento.description ?? "").replace(/\s+/g, " ").slice(0, 240),
      });
    }

    for (const ref of refs?.refs ?? []) {
      if (ref.status !== "VERIFIED" || !ref.boe_id) continue;
      for (const articulo of ref.articles ?? []) {
        const key = `${ref.boe_id}|${articulo.block_id ?? ""}|${articulo.number ?? 0}`;
        const fila =
          leyesMap.get(key) ??
          ({
            norma: ref.norma ?? "",
            boe_id: ref.boe_id,
            block_id: articulo.block_id ?? null,
            article: articulo.number ?? 0,
            casos: 0,
          } satisfies Recomendaciones["leyes"][number]);
        fila.casos += 1;
        leyesMap.set(key, fila);
      }
    }
  }

  return {
    frases,
    argumentos,
    leyes: [...leyesMap.values()].sort((a, b) => b.casos - a.casos).slice(0, 6),
  };
}
