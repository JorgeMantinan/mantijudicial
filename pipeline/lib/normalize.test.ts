import { describe, expect, it } from "vitest";
import { enrichmentCoreSchema } from "./enrich_schema.js";
import { normalizeEnrichmentInput } from "./normalize.js";

function obj(value: unknown): Record<string, unknown> {
  return normalizeEnrichmentInput(value) as Record<string, unknown>;
}

describe("normalizeEnrichmentInput", () => {
  it("corrige erratas de rama civil", () => {
    const out = obj({ classification: { civil_branch: "CONTRACTIAL" } });
    expect((out.classification as { civil_branch: string }).civil_branch).toBe("CONTRACTUAL");
  });

  it("mapea kind COURT a PUBLIC_ENTITY", () => {
    const out = obj({ parties: [{ kind: "COURT", side: "COURT" }] });
    const party = (out.parties as Array<Record<string, unknown>>)[0]!;
    expect(party.kind).toBe("PUBLIC_ENTITY");
    expect(party.side).toBe("COURT");
  });

  it("normaliza valores en espanol y con espacios", () => {
    const out = obj({
      parties: [{ side: " demandante ", is_consumer: "Si" }],
      facts: [{ fact_type: "Procesal", status: "probado" }],
      arguments: [{ type: "LEGAL" }],
    });
    const party = (out.parties as Array<Record<string, unknown>>)[0]!;
    const fact = (out.facts as Array<Record<string, unknown>>)[0]!;
    const argument = (out.arguments as Array<Record<string, unknown>>)[0]!;
    expect(party.side).toBe("PLAINTIFF");
    expect(party.is_consumer).toBe("YES");
    expect(fact.fact_type).toBe("PROCEDURAL");
    expect(fact.status).toBe("PROVEN");
    expect(argument.type).toBe("LEGAL");
  });

  it("convierte numeros y booleanos escritos como texto", () => {
    const out = obj({
      facts: [{ importance: "4", sources: [{ page: "3" }] }],
      reasoning: [{ is_literal_quote: "true" }],
    });
    const fact = (out.facts as Array<Record<string, unknown>>)[0]!;
    expect(fact.importance).toBe(4);
    expect((fact.sources as Array<Record<string, unknown>>)[0]!.page).toBe(3);
    const holding = (out.reasoning as Array<Record<string, unknown>>)[0]!;
    expect(holding.is_literal_quote).toBe(true);
  });

  it("conserva valores invalidos para que Zod los reporte", () => {
    const out = obj({ classification: { civil_branch: "NO_EXISTE" } });
    expect((out.classification as { civil_branch: string }).civil_branch).toBe("NO_EXISTE");
  });

  it("reconstruye outcome cuando el modelo lo aplana", () => {
    const out = obj({
      outcome: "Se estima el recurso",
      cassation_outcome: "estimado",
      recurring_side: "plaintiff",
      decisions: [],
      claim_outcomes: [],
      reasoning_summary: "rs",
    });
    expect(out.outcome).toEqual({
      cassation_outcome: "ESTIMED",
      recurring_side: "PLAINTIFF",
      decisions: [],
      claim_outcomes: [],
      reasoning_summary: "rs",
    });
  });

  it("pasa el esquema completo con un payload normalizado", () => {
    const payload = {
      summary: { headline: "h", summary: "s" },
      parties: [{ party_id: "PARTY-001", name: "A", side: "plaintiff", kind: "court" }],
      claims: [],
      facts: [{ fact_id: "FACT-001", description: "d", fact_type: "juridical" }],
      timeline: [],
      arguments: [],
      reasoning: [{ holding_id: "HOLD-001", statement: "st", topic: "t" }],
      cited_laws: [],
      cited_case_law: [],
      outcome: { cassation_outcome: "estimado", recurring_side: "defendant" },
      issues: [],
      classification: { civil_branch: "contractual" },
    };
    const parsed = enrichmentCoreSchema.safeParse(normalizeEnrichmentInput(payload));
    expect(parsed.success).toBe(true);
  });
});
