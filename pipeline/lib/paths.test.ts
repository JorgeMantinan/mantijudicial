import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `REPO_ROOT` se calcula al importar el módulo, así que cada supuesto se
 * carga de nuevo con `vi.resetModules()` después de fijar (o borrar)
 * `MANTIJUDICIAL_ROOT`.
 */
const rootPrevio = process.env.MANTIJUDICIAL_ROOT;
let raiz: string;
let conRaiz: typeof import("./paths");

beforeAll(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "mj-paths-"));
  // El valor se recorta: un espacio sobrante no debe romper la raíz.
  process.env.MANTIJUDICIAL_ROOT = ` ${raiz} `;
  vi.resetModules();
  conRaiz = await import("./paths.js");
});

afterAll(async () => {
  if (rootPrevio === undefined) delete process.env.MANTIJUDICIAL_ROOT;
  else process.env.MANTIJUDICIAL_ROOT = rootPrevio;
  await rm(raiz, { recursive: true, force: true });
});

describe("paths", () => {
  it("usa MANTIJUDICIAL_ROOT como raíz del corpus", () => {
    expect(conRaiz.REPO_ROOT).toBe(path.resolve(raiz));
    expect(conRaiz.CASES_DIR).toBe(path.join(path.resolve(raiz), "cases"));
    expect(conRaiz.LAWS_DIR).toBe(path.join(path.resolve(raiz), "laws"));
    expect(conRaiz.MANIFEST_PATH).toBe(path.join(path.resolve(raiz), "cases", "manifest.json"));
  });

  it("caseDir une CASES_DIR con el nombre del caso", () => {
    expect(conRaiz.caseDir("case_000001")).toBe(path.join(conRaiz.CASES_DIR, "case_000001"));
  });

  it("sin MANTIJUDICIAL_ROOT cae en la raíz del repositorio", async () => {
    delete process.env.MANTIJUDICIAL_ROOT;
    vi.resetModules();
    const sinRaiz = await import("./paths.js");
    const esperado = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
    expect(sinRaiz.REPO_ROOT).toBe(esperado);
    expect(sinRaiz.caseDir("case_000002")).toBe(path.join(esperado, "cases", "case_000002"));
  });
});
