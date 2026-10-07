import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export type AuditAction =
  | "share.grant"
  | "share.revoke"
  | "review.update"
  | "golden.confirm"
  | "note.create"
  | "note.delete"
  | "case.ingest"
  | "case.reanalyze"
  | "case.archived"
  | "case.restored"
  | "user.create"
  | "user.mfa_enabled"
  | "user.mfa_disabled"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout";

export interface AuditEntry {
  at: string;
  actor: string;
  action: AuditAction;
  resource: string;
  details: Record<string, unknown>;
  /** sha256(previo + contenido): cadena de integridad del log. */
  hash?: string;
}

function calcularHash(previo: string, record: AuditEntry): string {
  const { hash: _ignorado, ...resto } = record;
  return createHash("sha256")
    .update(previo)
    .update(JSON.stringify(resto))
    .digest("hex");
}

async function ultimaMarca(filePath: string): Promise<string> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const lineas = raw.split(/\r?\n/).filter((linea) => linea.trim());
    if (lineas.length === 0) return "";
    const ultimaLinea = lineas[lineas.length - 1] ?? "";
    if (!ultimaLinea) return "";
    const ultima = JSON.parse(ultimaLinea) as AuditEntry;
    return ultima.hash ?? "";
  } catch {
    return "";
  }
}

/** Comprueba la cadena de hashes: `alteradas` > 0 significa log manipulado. */
export async function verificarAuditoria(
  filePath: string,
): Promise<{ total: number; alteradas: number }> {
  const raw = await fs.readFile(filePath, "utf8").catch(() => "");
  let previo = "";
  let total = 0;
  let alteradas = 0;
  for (const linea of raw.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    try {
      const entry = JSON.parse(linea) as AuditEntry;
      total += 1;
      if (entry.hash) {
        if (calcularHash(previo, entry) !== entry.hash) alteradas += 1;
        previo = entry.hash;
      }
    } catch {
      alteradas += 1;
    }
  }
  return { total, alteradas };
}

/** Cola en proceso: dos appends simultáneos (p. ej. dos logins) no deben
 * leer la misma última marca y romper la cadena de hash. */
let colaAudit: Promise<unknown> = Promise.resolve();

export async function appendAudit(
  filePath: string,
  entry: Omit<AuditEntry, "at">,
): Promise<AuditEntry> {
  const tarea = colaAudit.then(async (): Promise<AuditEntry> => {
    const record: AuditEntry = { at: new Date().toISOString(), ...entry };
    record.hash = calcularHash(await ultimaMarca(filePath), record);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
    return record;
  });
  colaAudit = tarea.catch(() => undefined);
  return tarea;
}

export async function readAudit(filePath: string, limit = 200): Promise<AuditEntry[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const entries: AuditEntry[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      // línea corrupta: se ignora para no perder el histórico
    }
  }
  return entries.slice(-limit);
}
