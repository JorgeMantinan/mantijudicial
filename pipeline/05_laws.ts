import fs from "node:fs/promises";
import path from "node:path";
import { BOE_API_BASE, boeGet, boeGetJson } from "./lib/boe_api.js";
import { parseIndiceJson, parseTextoXml } from "./lib/boe_xml.js";
import { LAWS_DIR } from "./lib/paths.js";
import { resolveNorm, type CatalogNorm, type NormTarget } from "./lib/norm_resolver.js";

const NOTICE =
  "Texto consolidado de carácter meramente informativo. " +
  "Basado en datos de la Agencia Estatal BOE (datos abiertos); para decisiones jurídicas " +
  "debe consultarse la publicación oficial.";

interface CatalogFile {
  retrieved_at: string;
  notice: string;
  count: number;
  norms: CatalogNorm[];
}

interface LawFile {
  boe_id: string;
  titulo: string;
  rango: string;
  ambito: string;
  numero_oficial: string;
  fecha_publicacion: string;
  url_html: string;
  catalog_updated_at: string;
  retrieved_at: string;
  notice: string;
  blocks: Array<{
    id: string;
    tipo: string;
    titulo: string;
    fecha_vigencia: string;
    texto: string;
  }>;
}

const TARGETS: NormTarget[] = [
  { key: "codigo-civil", pattern: "codigo civil", known: "BOE-A-1889-4763" },
  { key: "codigo-penal", pattern: "codigo penal", known: "BOE-A-1995-25444" },
  { key: "ley-enjuiciamiento-civil", pattern: "enjuiciamiento civil", known: "BOE-A-2000-323" },
  { key: "constitucion", pattern: "constitucion espanola", known: "BOE-A-1978-31229" },
  { key: "codigo-comercio", pattern: "codigo de comercio", require: "1885" },
  { key: "ley-enjuiciamiento-criminal", pattern: "enjuiciamiento criminal", require: "1882" },
  { key: "ley-hipotecaria", pattern: "ley hipotecaria", known: "BOE-A-1946-2453" },
  { key: "reglamento-hipotecario", pattern: "reglamento hipotecario" },
  { key: "ley-cambiaria", pattern: "cambiaria" },
  { key: "mercado-de-valores", pattern: "mercado de valores", known: "BOE-A-1988-18764" },
  {
    key: "cantidades-anticipadas",
    pattern: "cantidades anticipadas",
    known: "BOE-A-1968-909",
  },
  { key: "propiedad-intelectual", pattern: "propiedad intelectual", require: "1/1996" },
  { key: "arrendamientos-urbanos", pattern: "arrendamientos urbanos", require: "29/1994" },
  { key: "propiedad-horizontal", pattern: "propiedad horizontal", require: "1960" },
  { key: "consumidores", pattern: "consumidores y usuarios", require: "1/2007" },
  { key: "jurisdiccion-voluntaria", pattern: "jurisdiccion voluntaria", require: "15/2015" },
  { key: "arbitraje", pattern: "arbitraje", require: "60/2003" },
  { key: "sociedades-capital", pattern: "sociedades de capital", require: "1/2010" },
  { key: "concursal", pattern: "concursal", require: "1/2020" },
  { key: "poder-judicial", pattern: "poder judicial", require: "6/1985" },
  { key: "ley-concursal-2003", pattern: "concursal", known: "BOE-A-2003-13813" },
  { key: "ley-14-2006", pattern: "reproduccion humana asistida", known: "BOE-A-2006-9292" },
  { key: "ley-41-2002", pattern: "autonomia del paciente", known: "BOE-A-2002-22188" },
  { key: "ley-26-1988", pattern: "entidades de credito", known: "BOE-A-1988-18845" },
  { key: "circular-bde-5-2012", pattern: "circular 5/2012", known: "BOE-A-2012-9058" },
  { key: "rdl-5-1994", pattern: "fondos de garantia", known: "BOE-A-1994-9800" },
  { key: "lo-11-2015", pattern: "proteccion integral de menores", known: "BOE-A-2015-10141" },
  { key: "rd-412-1996", pattern: "412/1996", known: "BOE-A-1996-6644" },
  { key: "contrato-de-seguro", pattern: "contrato de seguro", known: "BOE-A-1980-22501" },
  { key: "seguros-privados", pattern: "seguros privados", known: "BOE-A-1995-24262" },
  { key: "mercado-hipotecario", pattern: "mercado hipotecario", known: "BOE-A-1981-8598" },
  { key: "estado-alarma-2020", pattern: "estado de alarma", known: "BOE-A-2020-3692" },
  { key: "ley-42-2015-lec", pattern: "reforma de la ley 1/2000", known: "BOE-A-2015-10727" },
  { key: "ley-9-2017-contratos", pattern: "contratos del sector publico", known: "BOE-A-2017-12902" },
  { key: "ley-41-2007-rmv", pattern: "ley 2/1981", known: "BOE-A-2007-21086" },
];

interface LawArgs {
  catalogOnly: boolean;
  force: boolean;
  limit: number | null;
  delayMs: number;
}

function parseArgs(argv: string[]): LawArgs {
  const args: LawArgs = { catalogOnly: false, force: false, limit: null, delayMs: 400 };
  for (const arg of argv) {
    if (arg === "--catalog") args.catalogOnly = true;
    if (arg === "--force") args.force = true;
    const limit = arg.match(/^--limit=(\d+)$/);
    if (limit?.[1]) args.limit = Number(limit[1]);
    const delay = arg.match(/^--delay=(\d+)$/);
    if (delay?.[1]) args.delayMs = Number(delay[1]);
  }
  return args;
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

async function fetchCatalog(): Promise<CatalogNorm[]> {
  const pageSize = 10_000;
  const norms: CatalogNorm[] = [];
  for (let offset = 0; offset < 200_000; offset += pageSize) {
    const payload = await boeGetJson<{ data?: CatalogNorm[] }>(
      `${BOE_API_BASE}/legislacion-consolidada?limit=${pageSize}&offset=${offset}`,
      { timeoutMs: 180_000, minIntervalMs: 400 },
    );
    const batch = Array.isArray(payload.data) ? payload.data : [];
    norms.push(...batch);
    if (batch.length < pageSize) break;
  }
  return norms;
}

async function loadCatalog(): Promise<CatalogFile> {
  const catalogPath = path.join(LAWS_DIR, "catalog.json");
  const existing = await readJson<CatalogFile>(catalogPath);
  const staleDays = existing
    ? (Date.now() - Date.parse(existing.retrieved_at)) / 86_400_000
    : Number.POSITIVE_INFINITY;
  if (existing && staleDays <= 7) return existing;

  process.stdout.write("Descargando catálogo BOE...\n");
  const norms = await fetchCatalog();
  const catalog: CatalogFile = {
    retrieved_at: new Date().toISOString(),
    notice: NOTICE,
    count: norms.length,
    norms,
  };
  await writeJson(catalogPath, catalog);
  process.stdout.write(`Catálogo: ${norms.length} normas consolidadas\n`);
  return catalog;
}

async function fetchNorm(norm: CatalogNorm, delayMs: number): Promise<LawFile> {
  const base = `${BOE_API_BASE}/legislacion-consolidada/id/${norm.identificador}`;
  const [indice, texto] = await Promise.all([
    boeGetJson<unknown>(`${base}/texto/indice`, {
      minIntervalMs: delayMs,
      timeoutMs: 180_000,
    }),
    boeGet(`${base}/texto`, { accept: "application/xml", minIntervalMs: delayMs, timeoutMs: 300_000 }),
  ]);
  const entries = parseIndiceJson(indice);
  const titles = new Map(entries.map((entry) => [entry.id, entry.titulo]));
  const blocks = parseTextoXml(texto, new Date().toISOString().slice(0, 10).replace(/-/g, "")).map(
    (block) => ({
      id: block.id,
      tipo: block.tipo,
      titulo: titles.get(block.id) ?? "",
      fecha_vigencia: block.fecha_vigencia,
      texto: block.texto,
    }),
  );
  return {
    boe_id: norm.identificador,
    titulo: norm.titulo,
    rango: norm.rango.texto,
    ambito: norm.ambito.texto,
    numero_oficial: norm.numero_oficial,
    fecha_publicacion: norm.fecha_publicacion,
    url_html: norm.url_html_consolidada,
    catalog_updated_at: norm.fecha_actualizacion,
    retrieved_at: new Date().toISOString(),
    notice: NOTICE,
    blocks,
  };
}

interface IndexEntry {
  boe_id: string;
  titulo: string;
  blocks: number;
  chars: number;
  retrieved_at: string;
}

async function scanNormsForIndex(): Promise<IndexEntry[]> {
  const dir = path.join(LAWS_DIR, "norms");
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out: IndexEntry[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const law = await readJson<LawFile>(path.join(dir, name));
    if (!law?.boe_id) continue;
    out.push({
      boe_id: law.boe_id,
      titulo: law.titulo,
      blocks: law.blocks.length,
      chars: law.blocks.reduce((sum, block) => sum + block.texto.length, 0),
      retrieved_at: law.retrieved_at,
    });
  }
  return out.sort((a, b) => a.boe_id.localeCompare(b.boe_id));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(LAWS_DIR, { recursive: true });

  const catalog = await loadCatalog();
  if (args.catalogOnly) return;

  const resolved: Array<{ target: NormTarget; norm: CatalogNorm | null }> = TARGETS.map((target) => ({
    target,
    norm: resolveNorm(target, catalog.norms),
  }));

  process.stdout.write("Normas seleccionadas:\n");
  for (const { target, norm } of resolved) {
    process.stdout.write(
      `  ${target.key.padEnd(26)} ${norm ? norm.identificador : "SIN COINCIDENCIA"}  ${
        norm ? norm.titulo.slice(0, 90) : target.pattern
      }\n`,
    );
  }

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  const queue = resolved.filter((item) => item.norm !== null);
  for (const item of queue) {
    const norm = item.norm!;
    if (args.limit !== null && fetched >= args.limit) break;
    const filePath = path.join(LAWS_DIR, "norms", `${norm.identificador}.json`);
    const existing = await readJson<LawFile>(filePath);
    if (existing && !args.force && existing.catalog_updated_at === norm.fecha_actualizacion) {
      skipped += 1;
      continue;
    }
    try {
      const law = await fetchNorm(norm, args.delayMs);
      await writeJson(filePath, law);
      fetched += 1;
      process.stdout.write(
        `  ${norm.identificador}: ${law.blocks.length} bloques, ` +
          `${law.blocks.reduce((sum, block) => sum + block.texto.length, 0)} caracteres\n`,
      );
    } catch (error) {
      failed += 1;
      process.stderr.write(`  ${norm.identificador}: ERROR ${String(error)}\n`);
    }
  }

  const index = await scanNormsForIndex();
  await writeJson(path.join(LAWS_DIR, "index.json"), {
    generated_at: new Date().toISOString(),
    notice: NOTICE,
    norms: index,
  });

  process.stdout.write("\n== FASE D: LEGISLACIÓN BOE ==\n");
  process.stdout.write(`Catálogo: ${catalog.count} normas\n`);
  process.stdout.write(`Descargadas: ${fetched}\n`);
  process.stdout.write(`Ya vigentes localmente: ${skipped}\n`);
  process.stdout.write(`Fallidas: ${failed}\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
