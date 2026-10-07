import type { z } from "zod";
import { describe, expect, it } from "vitest";
import {
  buildReviewRecord,
  enrichmentCoreSchema,
  PROMPT_VERSION,
  SECTION_FILES,
  sectionFilesWithCaseId,
  type EnrichmentCore,
} from "./enrich_schema.js";

type NucleoInput = z.input<typeof enrichmentCoreSchema>;

/** Núcleo mínimo: todo lo opcional lleva su default y el parse lo rellena. */
function nucleo(overrides: Partial<NucleoInput> = {}): EnrichmentCore {
  return enrichmentCoreSchema.parse({
    summary: {
      headline: "Estimación de la casación sobre cláusula suelo",
      summary:
        "El banco recurrió contra la sentencia que anuló la cláusula suelo. El TS estima el recurso parcialmente.",
    },
    parties: [{ party_id: "PARTY-001", name: "Banco demandado", side: "DEFENDANT", kind: "COMPANY" }],
    claims: [],
    facts: [],
    timeline: [],
    arguments: [],
    reasoning: [],
    cited_laws: [],
    cited_case_law: [],
    outcome: { cassation_outcome: "ESTIMED", recurring_side: "DEFENDANT" },
    issues: [],
    classification: { civil_branch: "CONSUMER_ABUSIVE_CLAUSES" },
    ...overrides,
  });
}

describe("enrichmentCoreSchema", () => {
  it("acepta un núcleo mínimo y rellena los defaults", () => {
    const resultado = enrichmentCoreSchema.safeParse(nucleo());
    expect(resultado.success).toBe(true);
    if (!resultado.success) return;
    expect(resultado.data.summary.key_points).toEqual([]);
    expect(resultado.data.parties[0]?.representation).toBe("UNKNOWN");
    expect(resultado.data.outcome.reasoning_summary).toBe("UNKNOWN");
    expect(resultado.data.classification.finality_status).toBe("UNKNOWN");
  });

  it("rechaza una rama civil que no existe y un lado de parte inválido", () => {
    expect(
      enrichmentCoreSchema.safeParse({ ...nucleo(), classification: { civil_branch: "LABORAL" } })
        .success,
    ).toBe(false);
    expect(
      enrichmentCoreSchema.safeParse({
        ...nucleo(),
        parties: [{ party_id: "PARTY-002", name: "Demandante", side: "NADIE", kind: "PERSON" }],
      }).success,
    ).toBe(false);
  });
});

describe("sectionFilesWithCaseId", () => {
  it("genera los 12 ficheros de structured/ envueltos en su sección", () => {
    const salida = sectionFilesWithCaseId(nucleo(), "case_000001");
    expect(Object.keys(salida)).toHaveLength(Object.keys(SECTION_FILES).length);
    expect(Object.keys(salida).sort()).toEqual(Object.values(SECTION_FILES).sort());
    for (const valor of Object.values(salida)) {
      expect(valor).toMatchObject({ case_id: "case_000001" });
    }
  });

  it("usa la clave interna de cada sección (events, holdings, citations)", () => {
    const salida = sectionFilesWithCaseId(nucleo(), "case_000001");
    expect(salida["timeline.json"]).toEqual({ case_id: "case_000001", events: [] });
    expect(salida["reasoning.json"]).toEqual({ case_id: "case_000001", holdings: [] });
    expect(salida["cited_laws.json"]).toEqual({ case_id: "case_000001", citations: [] });
    expect(salida["summary.json"]).toMatchObject({ case_id: "case_000001" });
  });
});

describe("buildReviewRecord", () => {
  it("monta la ficha de revisión con estado inicial sin revisar", () => {
    const registro = buildReviewRecord({
      caseId: "case_000001",
      provider: "opencode",
      model: "modelo-local",
      inputChars: 120_000,
      tokens: { input: 30_000, output: 8_000, total: 38_000 },
      cost: 0.012,
      validation: "OK",
    });
    expect(registro.case_id).toBe("case_000001");
    expect(registro.extraction.prompt_version).toBe(PROMPT_VERSION);
    expect(registro.extraction.validation).toBe("OK");
    expect(registro.extraction.schema_errors).toEqual([]);
    expect(registro.review.status).toBe("UNREVIEWED");
    expect(registro.golden.isGoldenDataset).toBe(false);
  });

  it("acepta una extracción fallida sin tokens ni coste", () => {
    const registro = buildReviewRecord({
      caseId: "case_000002",
      provider: "opencode",
      model: "modelo-local",
      inputChars: 0,
      tokens: null,
      cost: null,
      validation: "AI_FAILED",
      schemaErrors: ["JSON inválido"],
    });
    expect(registro.extraction.validation).toBe("AI_FAILED");
    expect(registro.extraction.tokens).toBeNull();
    expect(registro.extraction.cost).toBeNull();
    expect(registro.extraction.schema_errors).toEqual(["JSON inválido"]);
  });
});
