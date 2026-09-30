import { describe, expect, it } from "vitest";
import { detectCitedSentencias, matchWithCorpus } from "./sentencias.js";

const TEXT = `
El Tribunal Supremo se remite a la doctrina de las SSTS 580/2020 y 581/2020, de 5 de noviembre,
y a la sentencia 809/2023, de la Audiencia Provincial. También al ATS 10302/2025.
En el caso se aplicó la sentencia 3706/2026.
`;

const CORPUS = [
  { caseDir: "case_000034", roj: "STS 3706/2026", ecli: "ES:TS:2026:3706" },
  { caseDir: "case_000010", roj: "STS 580/2020", ecli: "ES:TS:2020:580" },
  { caseDir: "case_000011", roj: null, ecli: null },
];

describe("detectCitedSentencias", () => {
  it("detecta SSTS, sentencias sueltas y ATS", () => {
    const found = detectCitedSentencias(TEXT);
    const keys = found.map((item) => `${item.numero}/${item.anio}`);
    expect(keys).toEqual(
      expect.arrayContaining(["580/2020", "581/2020", "10302/2025", "809/2023", "3706/2026"]),
    );
    expect(keys).toHaveLength(5);
  });

  it("no duplica la misma cita", () => {
    const found = detectCitedSentencias("sentencia 580/2020 y otra vez sentencia 580/2020");
    expect(found).toHaveLength(1);
  });

  it("devuelve vacío si no hay citas", () => {
    expect(detectCitedSentencias("no hay números aquí")).toEqual([]);
  });
});

describe("matchWithCorpus", () => {
  it("marca las que están en el corpus con su caso", () => {
    const result = matchWithCorpus(TEXT, CORPUS);
    const enCorpus = result.filter((item) => item.enCorpus).map((item) => item.caseId);
    expect(enCorpus).toEqual(expect.arrayContaining(["case_000034", "case_000010"]));
    const outside = result.find((item) => item.roj === "ATS 10302/2025");
    expect(outside?.enCorpus).toBe(false);
    expect(outside?.caseId).toBeNull();
  });

  it("ignora las que no son del tribunal", () => {
    const result = matchWithCorpus("sentencia 809/2023 de la AP", CORPUS);
    expect(result[0]?.enCorpus).toBe(false);
  });
});
