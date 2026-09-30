import { describe, expect, it } from "vitest";
import {
  renderCompareContext,
  buildComparePrompt,
  compareSchema,
  normalizeCompareInput,
  type CaseSignals,
} from "./compare.js";

function signals(overrides: Partial<CaseSignals>): CaseSignals {
  return {
    id: "case_000001",
    headline: "Caso",
    subtopic: "",
    branch: "CONTRACTUAL",
    outcome: "ESTIMED",
    recurringSide: "DEFENDANT",
    summary: "Resumen.",
    keyPoints: ["clave"],
    facts: ["hecho"],
    claims: ["pretensión"],
    issues: ["cuestión"],
    argumentsList: ["[DEFENDANT/LEGAL · ACEPTADO] argumento"],
    holdings: [{ topic: "buena fe", statement: "Frase.", doctrine: "STS 1/2020" }],
    laws: [{ norma: "CC", article: "1124", boeId: "BOE-A-1889-4763" }],
    ...overrides,
  };
}

const A = signals({});
const B = signals({ id: "case_000002", headline: "Otro caso", outcome: "DISMISSED" });

describe("compareSchema", () => {
  it("acepta un informe mínimo", () => {
    const parsed = compareSchema.safeParse({
      case_id: "case_000001",
      otro_caso: "case_000002",
      aplicabilidad: "ALTA",
      conclusion: "Conclusión.",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.similitudes).toEqual([]);
  });

  it("rechaza aplicabilidad fuera del enum", () => {
    expect(
      compareSchema.safeParse({
        case_id: "a",
        otro_caso: "b",
        aplicabilidad: "CRITICA",
        conclusion: "x",
      }).success,
    ).toBe(false);
  });
});

describe("normalizeCompareInput", () => {
  it("convierte cadenas sueltas en listas", () => {
    const normalized = normalizeCompareInput({
      case_id: "case_000001",
      otro_caso: "case_000002",
      aplicabilidad: "MEDIA",
      riesgos: "riesgo único",
      conclusion: "ok",
    });
    expect((normalized as { riesgos: string[] }).riesgos).toEqual(["riesgo único"]);
    expect(
      compareSchema.safeParse({
        ...(normalized as Record<string, unknown>),
        riesgos: ["riesgo único"],
      }).success,
    ).toBe(true);
  });

  it("no vacía las listas de objetos", () => {
    const normalized = normalizeCompareInput({
      case_id: "case_000001",
      otro_caso: "case_000002",
      aplicabilidad: "ALTA",
      similitudes: [{ titulo: "mismo banco", detalle: "idénticos hechos" }],
      argumentos_efectivos: [{ descripcion: "buena fe", outcome: "aceptado" }],
      huecos: { problema: "falta la escritura" },
      conclusion: "ok",
    });
    expect((normalized as { similitudes: unknown[] }).similitudes).toHaveLength(1);
    expect((normalized as { argumentos_efectivos: unknown[] }).argumentos_efectivos).toHaveLength(1);
    expect((normalized as { huecos: unknown[] }).huecos).toHaveLength(1);
    const parsed = compareSchema.safeParse(normalizeCompareInput(normalized));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.similitudes[0]?.aspecto).toBe("mismo banco");
      expect(parsed.data.argumentos_efectivos[0]?.argumento).toBe("buena fe");
      expect(parsed.data.argumentos_efectivos[0]?.resultado).toBe("ACEPTADO");
      expect(parsed.data.huecos[0]?.descripcion).toBe("falta la escritura");
    }
  });
});

describe("renderCompareContext", () => {
  const context = renderCompareContext(A, B);

  it("incluye ambos casos y sus datos", () => {
    expect(context).toContain("CASO PRINCIPAL (case_000001)");
    expect(context).toContain("CASO DE REFERENCIA (case_000002)");
    expect(context).toContain("Frase.");
    expect(context).toContain("BOE-A-1889-4763");
  });

  it("incluye la instrucción anti-alucinación", () => {
    expect(context).toContain("NO inventes casos");
    expect(buildComparePrompt("case_000001", "case_000002")).toContain("case_000002");
    expect(buildComparePrompt("case_000001", "case_000002")).toContain("huecos[]");
  });
});
