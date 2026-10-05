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
