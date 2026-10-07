import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `CASES_DIR` se calcula al importar `paths.ts`, así que el corpus temporal se
 * fija antes de cargar `./signals` (mismo truco que `auth.test.ts`).
 */
const rootPrevio = process.env.MANTIJUDICIAL_ROOT;
let raiz: string;
let signals: typeof import("./signals");

async function escribir(caseId: string, fichero: string, datos: unknown): Promise<void> {
  await writeFile(
    path.join(raiz, "cases", caseId, "structured", fichero),
    `${JSON.stringify(datos, null, 2)}\n`,
    "utf8",
  );
}

beforeAll(async () => {
  raiz = await mkdtemp(path.join(tmpdir(), "mj-signales-"));
  process.env.MANTIJUDICIAL_ROOT = raiz;
  await mkdir(path.join(raiz, "cases", "case_000001", "structured"), { recursive: true });
  await mkdir(path.join(raiz, "cases", "case_000002", "structured"), { recursive: true });

  await escribir("case_000001", "summary.json", {
    summary: {
      headline: "Nulidad de la cláusula suelo y restitución de cantidades",
      summary:
        "La demandante impugnó la cláusula suelo del préstamo hipotecario. El TS estima el recurso del banco en el alcance de la restitución.",
      key_points: ["Estimación parcial", "Restitución de intereses"],
    },
  });
  await escribir("case_000001", "classification.json", {
    classification: { civil_branch: "CONSUMER_ABUSIVE_CLAUSES", subtopic: "cláusula suelo" },
  });
  await escribir("case_000001", "outcome.json", {
    outcome: { cassation_outcome: "ESTIMED", recurring_side: "DEFENDANT" },
  });
  await escribir("case_000001", "facts.json", {
    facts: [{ description: "El banco fijó una cláusula suelo del 4 %." }],
  });
  await escribir("case_000001", "claims.json", {
    claims: [{ description: "La demandante pidió la nulidad de la cláusula." }],
  });
  await escribir("case_000001", "issues.json", {
    issues: [{ topic: "transparencia", description: "Control de transparencia ex ante." }],
  });
  await escribir("case_000001", "arguments.json", {
    arguments: [
      { side: "PLAINTIFF", type: "LEGAL", outcome: "ACCEPTED", description: "Invoca la doctrina del TS." },
    ],
  });
  await escribir("case_000001", "reasoning.json", {
    holdings: [
      {
        topic: "cláusula suelo",
        statement: "La cláusula no supera el control de transparencia.",
        doctrine: "STS 150/2017",
      },
      { topic: "sin frase" },
    ],
  });
  await escribir("case_000001", "law_refs.json", {
    refs: [
      { norma: "CC", article_raw: "art. 1124 CC", boe_id: "BOE-A-1889-4763", status: "VERIFIED" },
      { norma: "LEC", article_raw: "art. 447 LEC", boe_id: "BOE-A-2000-323", status: "PENDING" },
    ],
  });
  // case_000002: directorio creado pero sin ningún JSON de enriquecimiento.

  vi.resetModules();
  signals = await import("./signals.js");
});

afterAll(async () => {
  if (rootPrevio === undefined) delete process.env.MANTIJUDICIAL_ROOT;
  else process.env.MANTIJUDICIAL_ROOT = rootPrevio;
  await rm(raiz, { recursive: true, force: true });
});

describe("loadSignals", () => {
  it("monta las señales de un caso enriquecido", async () => {
    const señales = await signals.loadSignals("case_000001");
    expect(señales).not.toBeNull();
    if (!señales) return;
    expect(señales.id).toBe("case_000001");
    expect(señales.headline).toBe("Nulidad de la cláusula suelo y restitución de cantidades");
    expect(señales.branch).toBe("CONSUMER_ABUSIVE_CLAUSES");
    expect(señales.subtopic).toBe("cláusula suelo");
    expect(señales.outcome).toBe("ESTIMED");
    expect(señales.recurringSide).toBe("DEFENDANT");
    expect(señales.keyPoints).toEqual(["Estimación parcial", "Restitución de intereses"]);
    expect(señales.facts).toEqual(["El banco fijó una cláusula suelo del 4 %."]);
    expect(señales.issues).toEqual(["transparencia: Control de transparencia ex ante."]);
    expect(señales.argumentsList).toEqual([
      "[PLAINTIFF/LEGAL · ACCEPTED] Invoca la doctrina del TS.",
    ]);
    // La frase sin `statement` no cuenta como holding.
    expect(señales.holdings).toHaveLength(1);
    expect(señales.holdings[0]).toEqual({
      topic: "cláusula suelo",
      statement: "La cláusula no supera el control de transparencia.",
      doctrine: "STS 150/2017",
    });
    // Solo las referencias VERIFIED alimentan el contexto legal.
    expect(señales.laws).toEqual([
      { norma: "CC", article: "art. 1124 CC", boeId: "BOE-A-1889-4763" },
    ]);
  });

  it("devuelve null si el caso no está enriquecido o no existe", async () => {
    expect(await signals.loadSignals("case_000002")).toBeNull();
    expect(await signals.loadSignals("case_999999")).toBeNull();
  });
});

describe("loadLeyesForCase", () => {
  it("devuelve [] cuando no hay referencias verificadas", async () => {
    expect(await signals.loadLeyesForCase("case_000002")).toEqual([]);
    expect(await signals.loadLeyesForCase("case_999999")).toEqual([]);
  });
});
