import { describe, expect, it } from "vitest";
import { caseMetadataSchema, type CaseMetadata } from "./schema.js";

function metadatos(overrides: Partial<CaseMetadata> = {}): CaseMetadata {
  return {
    case_id: "case_000001",
    source_type: "PDF",
    source: "PODER_JUDICIAL_ES",
    source_url: "https://www.poderjudicial.es/cgpj",
    roj: "ROJ 100/2026",
    ecli: "ES:TS:2026:100",
    id_cendoj: "123456789",
    court: "Tribunal Supremo · Sala Primera",
    court_hierarchy_level: "SUPREMO",
    seat: "Madrid",
    section: "Sección Primera",
    resolution_date: "2026-01-15",
    rapporteur: "Excmo. Sr. D. Uno Dos Tres",
    procedure_type: "RECURSO DE CASACIÓN",
    appeal_number: "245/2025",
    resolution_number: "10/2026",
    civil_branch: "CONTRACTUAL",
    finality_status: "FIRM",
    retrieval_date: "2026-02-01",
    retrieved_by: "pipeline:metadata",
    usage_context: "análisis de jurisprudencia",
    sha256: "a".repeat(64),
    search_term_used: "cláusula suelo",
    ...overrides,
  };
}

describe("caseMetadataSchema", () => {
  it("acepta unos metadatos completos", () => {
    const resultado = caseMetadataSchema.safeParse(metadatos());
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.case_id).toBe("case_000001");
  });

  it("rechaza el objeto si falta case_id", () => {
    const { case_id: _sinUsar, ...sinCaseId } = metadatos();
    expect(caseMetadataSchema.safeParse(sinCaseId).success).toBe(false);
  });

  it("rechaza valores que no son cadenas", () => {
    expect(caseMetadataSchema.safeParse(metadatos({ roj: 42 as unknown as string })).success).toBe(
      false,
    );
  });
});
