import { describe, expect, it } from "vitest";
import {
  buildViasPrompt,
  normalizeViasInput,
  renderViasContext,
  viasSchema,
  type ViasContext,
} from "./vias.js";

const CONTEXT: ViasContext = {
  caseId: "case_000034",
  headline: "Novación de cláusula suelo",
  subtopic: "préstamo hipotecario",
  branch: "CONSUMER_ABUSIVE_CLAUSES",
  outcome: "ESTIMED",
  recurringSide: "DEFENDANT",
  summary: "Resumen del caso.",
  keyPoints: ["punto 1"],
  facts: ["hecho 1"],
  claims: ["pretensión 1"],
  issues: ["cuestión 1"],
  ownArguments: ["[DEFENDANT/LEGAL · ACCEPTED] argumento"],
  similar: [
    {
      id: "case_000039",
      headline: "Caso parecido",
      branch: "CONSUMER_ABUSIVE_CLAUSES",
      outcome: "ESTIMED",
      subtopic: "sub",
      holdings: [
        {
          topic: "buena fe",
          statement: "Frase del tribunal.",
          doctrine: "STS 580/2020",
        },
      ],
      argumentsList: [
        {
          side: "DEFENDANT",
          type: "LEGAL",
          outcome: "ACCEPTED",
          description: "Argumento aceptado.",
        },
      ],
      verifiedLaws: ["BOE-A-1889-4763"],
    },
  ],
  laws: [
    {
      boe_id: "BOE-A-1889-4763",
      sigla: "CC",
      titulo: "Código Civil",
      articles: [{ number: 1124, titulo: "Art 1124", texto: "La facultad de resolver..." }],
    },
  ],
};

describe("viasSchema", () => {
  it("acepta un informe mínimo válido", () => {
    const parsed = viasSchema.safeParse({
      case_id: "case_000034",
      vias: [{ id: "VIA-001", titulo: "T", estrategia: "E", fuerza: "ALTA" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.vias[0]?.argumentos).toEqual([]);
      expect(parsed.data.avisos).toEqual([]);
    }
  });

  it("exige al menos una vía y fuerza válida", () => {
    expect(viasSchema.safeParse({ case_id: "x", vias: [] }).success).toBe(false);
    expect(
      viasSchema.safeParse({
        case_id: "x",
        vias: [{ id: "VIA-001", titulo: "T", estrategia: "E", fuerza: "CRITICA" }],
      }).success,
    ).toBe(false);
  });
});

describe("renderViasContext", () => {
  const rendered = renderViasContext(CONTEXT);

  it("incluye el caso, los similares y las normas", () => {
    expect(rendered).toContain("CASO EN ANALISIS: case_000034");
    expect(rendered).toContain("CASOS SIMILARES DEL CORPUS (1)");
    expect(rendered).toContain("case_000039");
    expect(rendered).toContain("NORMAS VERIFICADAS (1)");
    expect(rendered).toContain("BOE-A-1889-4763");
  });

  it("trae las frases del tribunal y los argumentos aceptados de los similares", () => {
    expect(rendered).toContain("Frase del tribunal.");
    expect(rendered).toContain("Argumentos aceptados:");
    expect(rendered).toContain("Argumento aceptado.");
  });

  it("no se rompe con secciones vacías", () => {
    const empty = renderViasContext({ ...CONTEXT, similar: [], laws: [], facts: [] });
    expect(empty).toContain("(sin casos similares)");
    expect(empty).toContain("(sin normas verificadas)");
    expect(empty).toContain("Hechos");
  });
});

describe("normalizeViasInput", () => {
  it("recupera el esquema cuando el modelo cambia nombres y tipos", () => {
    const messy = {
      vias: [
        {
          titulo: "Nulidad",
          descripcion: "Estrategia concreta.",
          fuerza: "MUY ALTA",
          argumentos: [{ descripcion: "Argumento 1", apoyo_case_id: "case_000039" }],
          riesgos: "riesgo único",
          evidencia: "escritura pública",
        },
      ],
      huecos: ["falta la escritura"],
      leyes_relevantes: [{ norma: "BOE-A-1889-4763", articulo: "1124", motivo: "resolución" }],
      avisos: "una nota",
    };
    const parsed = viasSchema.safeParse(normalizeViasInput(messy));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.case_id).toBe("");
    const via = parsed.data.vias[0]!;
    expect(via.id).toBe("VIA-001");
    expect(via.fuerza).toBe("ALTA");
    expect(via.estrategia).toBe("Estrategia concreta.");
    expect(via.argumentos[0]?.argumento).toBe("Argumento 1");
    expect(via.riesgos).toEqual(["riesgo único"]);
    expect(parsed.data.huecos[0]?.descripcion).toBe("falta la escritura");
    expect(parsed.data.leyes_relevantes[0]?.article).toBe("1124");
    expect(parsed.data.avisos).toEqual(["una nota"]);
  });

  it("deja intacto un payload ya correcto", () => {
    const valid = {
      case_id: "case_000034",
      vias: [{ id: "VIA-001", titulo: "T", estrategia: "E", fuerza: "BAJA" }],
    };
    expect(normalizeViasInput(valid)).toEqual(valid);
  });
});

describe("buildViasPrompt", () => {
  const prompt = buildViasPrompt("case_000034");

  it("fija las reglas anti-alucinación", () => {
    expect(prompt).toContain("NO inventes casos");
    expect(prompt).toContain("boe_id");
    expect(prompt).toContain("UN SOLO objeto JSON");
    expect(prompt).toContain("case_000034");
  });

  it("describe el esqueleto exacto de respuesta", () => {
    expect(prompt).toContain("ESQUELETO EXACTO DEL JSON");
    expect(prompt).toContain('"fuerza":"ALTA"');
  });
});
