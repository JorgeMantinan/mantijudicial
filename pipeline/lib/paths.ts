import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Raíz del repo. En servidor (Render) los datos viven en un disco aparte:
 * `MANTIJUDICIAL_ROOT` apunta ahí y debe coincidir con lo que lee la web.
 */
function resolveRoot(): string {
  const fromEnv = process.env.MANTIJUDICIAL_ROOT;
  if (fromEnv && fromEnv.trim().length > 0) return path.resolve(fromEnv.trim());
  return path.resolve(HERE, "..", "..");
}

export const REPO_ROOT = resolveRoot();
export const CASES_DIR = path.join(REPO_ROOT, "cases");
export const LAWS_DIR = path.join(REPO_ROOT, "laws");
export const MANIFEST_PATH = path.join(CASES_DIR, "manifest.json");

export function caseDir(caseDirName: string): string {
  return path.join(CASES_DIR, caseDirName);
}
