import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(HERE, "..", "..");
export const CASES_DIR = path.join(REPO_ROOT, "cases");
export const LAWS_DIR = path.join(REPO_ROOT, "laws");
export const MANIFEST_PATH = path.join(CASES_DIR, "manifest.json");

export function caseDir(caseDirName: string): string {
  return path.join(CASES_DIR, caseDirName);
}
