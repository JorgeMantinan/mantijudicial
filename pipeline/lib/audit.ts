import fs from "node:fs/promises";
import path from "node:path";

export type AuditAction =
  | "share.grant"
  | "share.revoke"
  | "review.update"
  | "case.ingest"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout";

export interface AuditEntry {
  at: string;
  actor: string;
  action: AuditAction;
  resource: string;
  details: Record<string, unknown>;
}

export async function appendAudit(
  filePath: string,
  entry: Omit<AuditEntry, "at">,
): Promise<AuditEntry> {
  const record: AuditEntry = { at: new Date().toISOString(), ...entry };
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  return record;
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
