import fs from "node:fs/promises";
import path from "node:path";
import {
  boeIdsInText,
  detectOutcomeFromText,
  detectSiglasInText,
  falloSection,
  type GoldenEntry,
} from "@pipeline/eval";
import type { CompareReport } from "@pipeline/compare";
import {
  getLawBloques,
  listCases,
  readFirstJson,
  readJson,
  repoRoot,
  section,
  type NormaLigera,
} from "./dataset-base";

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
    const norm = await getLawBloques(ref.boe_id);
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
  const normCache = new Map<string, NormaLigera | null>();
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
      if (!normCache.has(ref.boe_id)) normCache.set(ref.boe_id, await getLawBloques(ref.boe_id));
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
            resumen: block.resumen,
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
