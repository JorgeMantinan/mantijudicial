import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { verificarAuditoria } from "@pipeline/audit";
import {
  getEvolucion,
  listCases,
  listLaws,
  readFirstJson,
  readJson,
  repoRoot,
  section,
} from "./dataset-base";

export interface InformeCaso {
  id: string;
  headline: string;
  branch: string;
  outcome: string;
  fecha: string;
  reviewStatus: string;
}

export interface InformeTema {
  topic: string;
  casos: number;
  distribution: Record<string, number>;
}

export interface Informe {
  desde: string;
  hasta: string;
  casos: InformeCaso[];
  porResultado: Record<string, number>;
  porRama: Record<string, number>;
  pendientes: number;
  temas: InformeTema[];
  periodos: string[];
  matriz: Array<{ topic: string; total: number; celdas: Record<string, number> }>;
  leyes: Array<{ norma: string; boe_id: string | null; veces: number }>;
}

/** Informe de un periodo (por fecha de resolucion) para imprimir o mandar. */
// Lecturas compartidas por las dos llamadas de /informes (periodo A y B):
// mismo fichero, mismos 60 s. Solo cachea lecturas crudas (sin filtrar por
// visibilidad), así ningún despacho ve datos de otro.
const lecturaCache = new Map<string, { at: number; valor: unknown }>();
async function memoClave<T>(clave: string, cargar: () => Promise<T>): Promise<T> {
  const hit = lecturaCache.get(clave);
  if (hit && Date.now() - hit.at < 60_000) {
    lecturaCache.delete(clave); // refresca el orden: se expulsa la menos usada
    lecturaCache.set(clave, hit);
    return hit.valor as T;
  }
  const valor = await cargar();
  // Expulsión FIFO/LRU: solo sale la entrada más vieja, nunca clear() total.
  while (lecturaCache.size > 800) {
    const masAntigua = lecturaCache.keys().next().value;
    if (masAntigua === undefined) break;
    lecturaCache.delete(masAntigua);
  }
  lecturaCache.set(clave, { at: Date.now(), valor });
  return valor;
}

export async function getInforme(
  desde: string,
  hasta: string,
  permitido: (caseId: string) => boolean = () => true,
  filtros: { branch?: string; outcome?: string } = {},
): Promise<Informe> {
  const enRango = (fecha: string): boolean => fecha >= desde && fecha <= hasta;
  const enFiltros = (entry: { branch: string; outcome: string }): boolean =>
    (!filtros.branch || entry.branch === filtros.branch) &&
    (!filtros.outcome || entry.outcome === filtros.outcome);

  const [items, temas] = await Promise.all([listCases(), getEvolucion()]);
  const casos: InformeCaso[] = [];
  for (const item of items) {
    if (!permitido(item.id)) continue;
    if (filtros.branch && item.branch !== filtros.branch) continue;
    if (filtros.outcome && item.outcome !== filtros.outcome) continue;
    const meta = await memoClave(`meta:${item.id}`, () =>
      readFirstJson<{ resolution_date?: string }>(
        path.join(repoRoot(), "cases", item.id, "metadata"),
      ),
    );
    const fecha = (meta?.resolution_date ?? "").slice(0, 10);
    if (fecha.length !== 10 || !enRango(fecha)) continue;
    casos.push({
      id: item.id,
      headline: item.headline,
      branch: item.branch,
      outcome: item.outcome,
      fecha,
      reviewStatus: item.reviewStatus,
    });
  }
  casos.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const porResultado: Record<string, number> = {};
  const porRama: Record<string, number> = {};
  for (const caso of casos) {
    porResultado[caso.outcome] = (porResultado[caso.outcome] ?? 0) + 1;
    porRama[caso.branch] = (porRama[caso.branch] ?? 0) + 1;
  }

  const leyesMap = new Map<string, { norma: string; boe_id: string | null; veces: number }>();
  for (const caso of casos) {
    const refs = await memoClave(`leyes:${caso.id}`, () =>
      section<{
        refs?: Array<{ status?: string; boe_id?: string | null; norma?: string }>;
      }>(caso.id, "law_refs.json"),
    );
    for (const ref of refs?.refs ?? []) {
      if (ref.status !== "VERIFIED") continue;
      const key = `${ref.norma ?? "?"}|${ref.boe_id ?? ""}`;
      const row =
        leyesMap.get(key) ?? { norma: ref.norma ?? "?", boe_id: ref.boe_id ?? null, veces: 0 };
      row.veces += 1;
      leyesMap.set(key, row);
    }
  }

  const periodTemas: InformeTema[] = temas
    .map((tema) => {
      const entries = tema.entries.filter(
        (entry) =>
          entry.fecha.slice(0, 10) >= desde &&
          entry.fecha.slice(0, 10) <= hasta &&
          permitido(entry.caseId) &&
          enFiltros(entry),
      );
      const distribution: Record<string, number> = {};
      for (const entry of entries) {
        distribution[entry.outcome] = (distribution[entry.outcome] ?? 0) + 1;
      }
      return { topic: tema.topic, casos: entries.length, distribution };
    })
    .filter((tema) => tema.casos >= 2)
    .sort((a, b) => b.casos - a.casos)
    .slice(0, 10);

  // Matriz tema × periodo (meses si el rango es corto, trimestres si es largo)
  const dias = Math.max(1, (Date.parse(hasta) - Date.parse(desde)) / 86_400_000 || 90);
  const porMes = dias <= 200;
  const etiqueta = (fecha: string): string => {
    const anio = fecha.slice(0, 4);
    const mes = Number(fecha.slice(5, 7));
    return porMes ? `${anio}-${String(mes).padStart(2, "0")}` : `${anio}-T${Math.ceil(mes / 3)}`;
  };
  const periodos: string[] = [];
  {
    let anio = Number(desde.slice(0, 4));
    let paso = Number(desde.slice(5, 7));
    const fin = etiqueta(hasta);
    for (let guard = 0; guard < 60; guard += 1) {
      const etiquetaActual = porMes
        ? `${anio}-${String(paso).padStart(2, "0")}`
        : `${anio}-T${Math.ceil(paso / 3)}`;
      if (etiquetaActual > fin) break;
      if (etiquetaActual >= etiqueta(desde) && !periodos.includes(etiquetaActual)) {
        periodos.push(etiquetaActual);
      }
      if (porMes) {
        paso += 1;
        if (paso > 12) {
          paso = 1;
          anio += 1;
        }
      } else {
        paso += 3;
        if (paso > 12) {
          paso -= 12;
          anio += 1;
        }
      }
    }
  }
  const matriz: Array<{ topic: string; total: number; celdas: Record<string, number> }> = [];
  for (const tema of temas) {
    const entries = tema.entries.filter(
      (entry) =>
        entry.fecha.slice(0, 10) >= desde &&
        entry.fecha.slice(0, 10) <= hasta &&
        permitido(entry.caseId) &&
        enFiltros(entry),
    );
    if (entries.length === 0) continue;
    const celdas: Record<string, number> = {};
    for (const entry of entries) {
      const clave = etiqueta(entry.fecha.slice(0, 10));
      celdas[clave] = (celdas[clave] ?? 0) + 1;
    }
    matriz.push({ topic: tema.topic, total: entries.length, celdas });
  }
  matriz.sort((a, b) => b.total - a.total);
  matriz.splice(15);

  return {
    desde,
    hasta,
    casos,
    porResultado,
    porRama,
    pendientes: casos.filter((caso) => caso.reviewStatus === "UNREVIEWED").length,
    temas: periodTemas,
    periodos,
    matriz,
    leyes: [...leyesMap.values()].sort((a, b) => b.veces - a.veces).slice(0, 12),
  };
}

export interface RevisionPersona {
  persona: string;
  casos: number;
  estados: Record<string, number>;
  ultimo: string;
}

/**
 * Carga de revisión por persona: quién ha revisado qué y cuánto lleva.
 * `permitido(caseId)` limita el agregado a los casos que el actor ve
 * (igual que getInforme/getTema): sin eso, /review filtraba la tabla pero
 * aquí se colaban los casos de otros despachos.
 */
export async function getRevisionPorPersona(
  permitido: (caseId: string) => boolean = () => true,
): Promise<{
  personas: RevisionPersona[];
  sinRevisador: number;
}> {
  const personas = new Map<string, RevisionPersona>();
  let sinRevisador = 0;

  const items = (await listCases()).filter((item) => permitido(item.id));
  // En paralelo: ~320 lecturas de review.json en serie costaban más que el
  // resto de la página (sin caché a propósito: /review debe verse al instante).
  const reviews = await Promise.all(
    items.map((item) =>
      section<{
        review?: { status?: string; reviewed_by?: string | null; reviewed_at?: string };
      }>(item.id, "review.json"),
    ),
  );

  items.forEach((_item, index) => {
    const review = reviews[index];
    const block = review?.review ?? {};
    const status = block.status ?? "UNREVIEWED";
    const persona = (block.reviewed_by ?? "").trim();
    if (!persona) {
      if (status !== "UNREVIEWED") sinRevisador += 1;
      return;
    }
    const row =
      personas.get(persona) ?? { persona, casos: 0, estados: {}, ultimo: "" };
    row.casos += 1;
    row.estados[status] = (row.estados[status] ?? 0) + 1;
    const cuando = block.reviewed_at ?? "";
    if (cuando > row.ultimo) row.ultimo = cuando;
    personas.set(persona, row);
  });

  return {
    personas: [...personas.values()].sort((a, b) => b.casos - a.casos),
    sinRevisador,
  };
}

export interface AuditoriaEntrada {
  at: string;
  actor: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
}

/** Últimas entradas de data/audit.log (la más reciente primero). */
export async function getAuditoria(limit = 50, resource?: string): Promise<AuditoriaEntrada[]> {
  const text = await fs
    .readFile(path.join(repoRoot(), "data", "audit.log"), "utf8")
    .catch(() => "");
  const rows: AuditoriaEntrada[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line) as AuditoriaEntrada);
    } catch {
      // línea corrupta: se ignora
    }
  }
  const filtradas = resource ? rows.filter((entrada) => entrada.resource === resource) : rows;
  return filtradas.slice(-limit).reverse();
}

/** Integridad de la cadena de hashes del audit.log (0 alteradas = intacto). */
export async function getAuditoriaIntegridad(): Promise<{ total: number; alteradas: number }> {
  return verificarAuditoria(path.join(repoRoot(), "data", "audit.log"));
}

export interface CostesIA {
  enriquecerCasos: number;
  enriquecerCoste: number;
  viasInformes: number;
  viasCoste: number;
  comparaciones: number;
  comparacionCoste: number;
  escritos: number;
  escritoCoste: number;
  total: number;
}

let costesCache: { value: CostesIA; at: number } | null = null;

/** Coste de IA registrado en los JSON de cada caso (en vivo, cache 60 s). */
export async function getCostesIA(): Promise<CostesIA> {
  if (costesCache && Date.now() - costesCache.at < 60_000) return costesCache.value;

  const value: CostesIA = {
    enriquecerCasos: 0,
    enriquecerCoste: 0,
    viasInformes: 0,
    viasCoste: 0,
    comparaciones: 0,
    comparacionCoste: 0,
    escritos: 0,
    escritoCoste: 0,
    total: 0,
  };

  const names = (await fs.readdir(path.join(repoRoot(), "cases")).catch(() => [] as string[])).filter(
    (name) => /^case_\d{6}$/.test(name),
  );

  for (const name of names) {
    const structured = path.join(repoRoot(), "cases", name, "structured");

    const review = await readJson<{ extraction?: { cost?: number } }>(
      path.join(structured, "review.json"),
    );
    if (typeof review?.extraction?.cost === "number") {
      value.enriquecerCasos += 1;
      value.enriquecerCoste += review.extraction.cost;
    }

    const vias = await readJson<{ analysis?: { cost?: number } }>(path.join(structured, "vias.json"));
    if (typeof vias?.analysis?.cost === "number") {
      value.viasInformes += 1;
      value.viasCoste += vias.analysis.cost;
    }

    const escrito = await readJson<{ analysis?: { cost?: number } }>(
      path.join(structured, "escrito.json"),
    );
    if (typeof escrito?.analysis?.cost === "number") {
      value.escritos += 1;
      value.escritoCoste += escrito.analysis.cost;
    }

    const files = await fs.readdir(structured).catch(() => [] as string[]);
    for (const file of files) {
      if (!/^compare_case_\d{6}\.json$/.test(file)) continue;
      const comparacion = await readJson<{ analysis?: { cost?: number } }>(
        path.join(structured, file),
      );
      if (typeof comparacion?.analysis?.cost === "number") {
        value.comparaciones += 1;
        value.comparacionCoste += comparacion.analysis.cost;
      }
    }
  }

  value.total =
    value.enriquecerCoste + value.viasCoste + value.comparacionCoste + value.escritoCoste;
  costesCache = { value, at: Date.now() };
  return value;
}

export interface CalidadCorpus {
  total: number;
  escaneados: string[];
  stale: string[];
  sinEnriquecer: string[];
  sinRevisar: string[];
}

let calidadCache: { value: CalidadCorpus; at: number } | null = null;

/** Estado de salud del corpus (cache 60 s). */
export async function getCalidadCorpus(): Promise<CalidadCorpus> {
  if (calidadCache && Date.now() - calidadCache.at < 60_000) return calidadCache.value;

  const items = await listCases();
  const value: CalidadCorpus = {
    total: items.length,
    escaneados: [],
    stale: [],
    sinEnriquecer: items.filter((item) => !item.enriched).map((item) => item.id),
    sinRevisar: items
      .filter((item) => item.enriched && item.reviewStatus === "UNREVIEWED")
      .map((item) => item.id),
  };

  for (const item of items) {
    if (item.stale) value.stale.push(item.id);
    const quality = await readJson<{ hasText?: boolean }>(
      path.join(repoRoot(), "cases", item.id, "extracted", "quality.json"),
    );
    if (quality && quality.hasText === false) value.escaneados.push(item.id);
  }

  calidadCache = { value, at: Date.now() };
  return value;
}

export interface BusquedaGuardada {
  nombre: string;
  q: string;
  kind?: string;
  branch?: string;
  outcome?: string;
  at: string;
}

function busquedasPath(orgId: string): string {
  const seguro = orgId.replace(/[^\w-]/g, "_").slice(0, 40) || "sin-org";
  return path.join(repoRoot(), "data", "org", seguro, "busquedas.json");
}

/** Búsquedas guardadas del despacho `orgId` (cada despacho tiene las suyas). */
export async function getBusquedas(orgId: string): Promise<BusquedaGuardada[]> {
  const list = await readJson<BusquedaGuardada[]>(busquedasPath(orgId));
  return Array.isArray(list) ? list : [];
}

export async function saveBusqueda(
  orgId: string,
  item: BusquedaGuardada,
): Promise<BusquedaGuardada[]> {
  const actuales = await getBusquedas(orgId);
  const sinRepetir = actuales.filter((busqueda) => busqueda.nombre !== item.nombre);
  const siguiente = [item, ...sinRepetir].slice(0, 20);
  await fs.mkdir(path.dirname(busquedasPath(orgId)), { recursive: true });
  await fs.writeFile(busquedasPath(orgId), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
  return siguiente;
}

export async function deleteBusqueda(orgId: string, nombre: string): Promise<BusquedaGuardada[]> {
  const actuales = await getBusquedas(orgId);
  const siguiente = actuales.filter((busqueda) => busqueda.nombre !== nombre);
  await fs.writeFile(busquedasPath(orgId), `${JSON.stringify(siguiente, null, 2)}\n`, "utf8");
  return siguiente;
}

async function dirSize(dir: string): Promise<number> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else {
      const stat = await fs.stat(full).catch(() => null);
      total += stat?.size ?? 0;
    }
  }
  return total;
}

export interface SistemaInfo {
  node: string;
  git: string | null;
  version: string;
  casos: number;
  normas: number;
  bytesCases: number;
  bytesLaws: number;
  ultimaSentencia: string | null;
  ultimaCopia: string | null;
}

let sistemaCache: { value: SistemaInfo; at: number } | null = null;

/** Estado del sistema para el panel de /eval (cache 60 s). */
export async function getSistemaInfo(): Promise<SistemaInfo> {
  if (sistemaCache && Date.now() - sistemaCache.at < 60_000) return sistemaCache.value;

  const [items, normas, evolucion, pkg] = await Promise.all([
    listCases(),
    listLaws(),
    getEvolucion(),
    readJson<{ version?: string }>(path.join(repoRoot(), "package.json")),
  ]);
  const [bytesCases, bytesLaws] = await Promise.all([
    dirSize(path.join(repoRoot(), "cases")),
    dirSize(path.join(repoRoot(), "laws")),
  ]);

  let git: string | null = null;
  try {
    git = execSync("git rev-parse --short HEAD", {
      cwd: repoRoot(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    git = null;
  }

  const fechas = evolucion
    .flatMap((tema) => tema.entries.map((entry) => entry.fecha.slice(0, 10)))
    .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    .sort();
  const copias = (await fs.readdir(path.join(repoRoot(), "backups")).catch(() => [] as string[]))
    .filter((name) => name.endsWith(".zip"))
    .sort();

  const value: SistemaInfo = {
    node: process.version,
    git,
    version: pkg?.version ?? "—",
    casos: items.length,
    normas: normas.length,
    bytesCases,
    bytesLaws,
    ultimaSentencia: fechas.length > 0 ? fechas[fechas.length - 1] : null,
    ultimaCopia: copias.length > 0 ? copias[copias.length - 1] : null,
  };
  sistemaCache = { value, at: Date.now() };
  return value;
}