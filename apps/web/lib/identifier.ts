import fs from "node:fs/promises";
import path from "node:path";
import { readFirstJson, repoRoot } from "./dataset";

export interface ExactMatch {
  caseId: string;
  headline: string;
  field: string;
  value: string;
}

interface Row {
  caseId: string;
  ecli: string;
  roj: string;
  appeal_number: string;
  resolution_number: string;
  headline: string;
}

let cache: { at: number; rows: Row[] } | null = null;
const TTL_MS = 30_000;

function norm(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadRows(): Promise<Row[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const dir = path.join(repoRoot(), "cases");
  const names = (await fs.readdir(dir).catch(() => [] as string[]))
    .filter((name) => /^case_\d{6}$/.test(name))
    .sort();
  const rows: Row[] = [];
  for (const caseId of names) {
    const [meta, summary] = await Promise.all([
      readFirstJson<{
        ecli?: string;
        roj?: string;
        appeal_number?: string;
        resolution_number?: string;
      }>(path.join(dir, caseId, "metadata")),
      readJson<{ summary?: { headline?: string } }>(
        path.join(dir, caseId, "structured", "summary.json"),
      ),
    ]);
    rows.push({
      caseId,
      ecli: meta?.ecli ?? "",
      roj: meta?.roj ?? "",
      appeal_number: meta?.appeal_number ?? "",
      resolution_number: meta?.resolution_number ?? "",
      headline: summary?.summary?.headline ?? "",
    });
  }
  cache = { at: Date.now(), rows };
  return rows;
}

/**
 * Búsqueda exacta por identificadores judiciales: ECLI, ROJ, número de
 * resolución o número de recurso.
 */
export async function findByIdentifier(query: string): Promise<ExactMatch[]> {
  const q = norm(query);
  if (q.length < 4) return [];
  const out: ExactMatch[] = [];

  if (/^CASE_?\d{6}$/.test(q.replace("-", "_"))) {
    const caseId = q.replace("CASE", "case").toLowerCase();
    const rows = await loadRows();
    const hit = rows.find((row) => row.caseId === caseId);
    if (hit) out.push({ caseId, headline: hit.headline, field: "Caso", value: caseId });
    return out;
  }

  const esEcli = /^ES:[A-Z]{2}:\d{4}:\d+/.test(q);
  const esRojo = /^(STS|ATS|SAP|AA|SAN)?\s*\d{1,5}\/\d{4}$/.test(q);
  if (!esEcli && !esRojo) return [];

  const rows = await loadRows();
  const sinPrefijo = q.replace(/^(STS|ATS|SAP|AA|SAN)/, "").trim();

  for (const row of rows) {
    if (out.length >= 8) break;
    if (esEcli) {
      if (norm(row.ecli) === q) {
        out.push({ caseId: row.caseId, headline: row.headline, field: "ECLI", value: row.ecli });
      }
      continue;
    }
    const roj = norm(row.roj);
    const resolucion = norm(row.resolution_number);
    const recurso = norm(row.appeal_number);
    if (roj && (roj === q || roj.endsWith(sinPrefijo))) {
      out.push({ caseId: row.caseId, headline: row.headline, field: "ROJ", value: row.roj });
    } else if (resolucion && resolucion === sinPrefijo) {
      out.push({
        caseId: row.caseId,
        headline: row.headline,
        field: "Nº de resolución",
        value: row.resolution_number,
      });
    } else if (recurso && recurso === sinPrefijo) {
      out.push({
        caseId: row.caseId,
        headline: row.headline,
        field: "Nº de recurso",
        value: row.appeal_number,
      });
    }
  }
  return out;
}
