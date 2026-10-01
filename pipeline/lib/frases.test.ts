import { describe, expect, it } from "vitest";
import { agruparFrases, normalizar, similitud, type FraseCaso } from "./frases.js";

describe("normalizar", () => {
  it("quita acentos, puntuación y palabras vacías", () => {
    const tokens = normalizar("La nave estaba instalada cerca de la propagación del incendio,");
    expect(tokens).toContain("nave");
    expect(tokens).toContain("propagacion");
    expect(tokens).toContain("incendio");
    expect(tokens).not.toContain("de");
    expect(tokens).not.toContain("la");
  });
});

describe("similitud", () => {
  it("premia el solape de tokens", () => {
    const a = new Set(["nave", "incendio", "parque", "industrial"]);
    const b = new Set(["nave", "incendio", "propagacion", "parque"]);
    expect(similitud(a, b)).toBeGreaterThan(0.4);
    expect(similitud(a, new Set(["contrato", "clausula", "suelo"]))).toBe(0);
  });
});

describe("agruparFrases", () => {
  const frases: FraseCaso[] = [
    { caseId: "case_000001", outcome: "ESTIMED", texto: "La nave se encontraba en un parque industrial cerca del incendio" },
    { caseId: "case_000002", outcome: "ESTIMED", texto: "La nave estaba instalada cerca de la propagación del incendio" },
    { caseId: "case_000003", outcome: "ESTIMED", texto: "La nave junto al incendio en el parque industrial" },
    { caseId: "case_000004", outcome: "DISMISSED", texto: "El contrato contenía una cláusula suelo de carácter abusivo" },
    { caseId: "case_000005", outcome: "DISMISSED", texto: "La cláusula suelo del contrato resultaba abusiva" },
    { caseId: "case_000006", outcome: "DISMISSED", texto: "Cláusula suelo abusiva en el contrato de préstamo" },
    { caseId: "case_000007", outcome: "ESTIMED", texto: "Sentencia totally distinta sobre competencia territorial" },
  ];

  it("agrupa frases parecidas y respeta el mínimo de casos", () => {
    const grupos = agruparFrases(frases, 3);
    expect(grupos.length).toBeGreaterThanOrEqual(2);
    const nave = grupos.find((grupo) => grupo.ejemplo.includes("nave"));
    expect(nave).toBeTruthy();
    expect(nave?.total).toBe(3);
    expect(nave?.distribucion.ESTIMED).toBe(3);
    const clausula = grupos.find((grupo) => grupo.ejemplo.toLowerCase().includes("cláusula"));
    expect(clausula?.total).toBe(3);
    expect(clausula?.distribucion.DISMISSED).toBe(3);
  });

  it("no mete dos veces al mismo caso en un grupo", () => {
    const repetida = [
      ...frases,
      { caseId: "case_000001", outcome: "ESTIMED", texto: "La nave en el parque industrial con incendio" },
    ];
    const grupos = agruparFrases(repetida, 3);
    const nave = grupos.find((grupo) => grupo.ejemplo.includes("nave"));
    expect(nave?.total).toBe(3);
  });
});
