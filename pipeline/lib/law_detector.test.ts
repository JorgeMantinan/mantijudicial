import { describe, expect, it } from "vitest";
import { detectLawCitations, missingCitations } from "./law_detector.js";

describe("detectLawCitations", () => {
  it("detecta artículos con punto de millar", () => {
    const found = detectLawCitations(
      "Se aplican los artículos 1.091, 1.258 y 1.287 del Código Civil.",
    );
    expect(found.map((item) => `${item.sigla}#${item.article}`)).toEqual([
      "CC#1091",
      "CC#1258",
      "CC#1287",
    ]);
    expect(found[0]?.boe_id).toBe("BOE-A-1889-4763");
  });

  it("detecta artículo y sigla", () => {
    expect(
      detectLawCitations("Conforme al art. 477 LEC y al art. 24 CE.").map(
        (item) => `${item.sigla}#${item.article}`,
      ),
    ).toEqual(["LEC#477", "CE#24"]);
  });

  it("detecta siglas sin artículo", () => {
    const found = detectLawCitations("Se invoca la Ley de Propiedad Horizontal (LPH).");
    expect(found.some((item) => item.sigla === "LPH" && item.article === null)).toBe(true);
  });

  it("no confunde las directivas europeas con la Constitución", () => {
    expect(detectLawCitations("Directiva 2003/71/CE del Parlamento Europeo.")).toEqual([]);
  });

  it("no repite la misma cita", () => {
    const found = detectLawCitations("art. 1124 CC. También art. 1124 CC.");
    expect(found.filter((item) => item.sigla === "CC")).toHaveLength(1);
  });
});

describe("missingCitations", () => {
  const TEXT = "Procede aplicar el art. 1124 CC y el art. 398 LEC.";

  it("devuelve solo lo que la IA no extrajo", () => {
    expect(missingCitations(TEXT, [{ norma: "CC", article: "1124" }]).map((item) => item.sigla)).toEqual([
      "LEC",
    ]);
  });

  it("no devuelve nada si ya está todo citado", () => {
    expect(
      missingCitations(TEXT, [
        { norma: "CC", article: "1124" },
        { norma: "LEC", article: "398" },
      ]),
    ).toEqual([]);
  });

  it("una citación sin artículo no bloquea la detección con artículo", () => {
    expect(missingCitations(TEXT, [{ norma: "CC", article: "UNKNOWN" }])).toHaveLength(2);
  });
});
