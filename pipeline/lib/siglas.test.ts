import { describe, expect, it } from "vitest";
import { boeIdsInText, detectSiglasInText, siglaOfNorma } from "./siglas.js";

describe("detectSiglasInText", () => {
  it("detecta siglas sueltas y nombres precedidos de artículo", () => {
    const texto =
      "Se estima el recurso al amparo del artículo 1124 del Código Civil y de la LEC.";
    const siglas = detectSiglasInText(texto);
    expect(siglas).toContain("CC");
    expect(siglas).toContain("LEC");
    expect(siglas).not.toContain("CP");
  });

  it("no cuenta «la Constitución» si no va precedida de un artículo", () => {
    // Es la fórmula de cierre de todo fallo: no prueba que el caso cite la CE.
    expect(detectSiglasInText("FALLAMOS que debemos estimar el recurso. La Constitución."))
      .not.toContain("CE");
    expect(detectSiglasInText("Según el artículo 14 de la Constitución")).toContain("CE");
  });
});

describe("boeIdsInText", () => {
  it("traduce las siglas detectadas a su boe_id", () => {
    expect(boeIdsInText("Aplicando el artículo 1124 CC y la LEC.")).toEqual([
      "BOE-A-1889-4763",
      "BOE-A-2000-323",
    ]);
  });

  it("excluye la LGDCU cuando la cita es la Ley 26/1984 (no está en el corpus)", () => {
    expect(boeIdsInText("Se aplica la Ley 26/1984 de protección al consumidor.")).toEqual([]);
    expect(boeIdsInText("Se aplica la Ley 26/1984 y el artículo 1 LEC.")).toEqual([
      "BOE-A-2000-323",
    ]);
  });
});

describe("siglaOfNorma", () => {
  it("normaliza el nombre largo que devuelve la IA", () => {
    expect(siglaOfNorma("Código Civil")).toBe("CC");
    expect(siglaOfNorma("Ley de Enjuiciamiento Civil")).toBe("LEC");
    expect(siglaOfNorma("  cc  ")).toBe("CC");
  });

  it("devuelve null para vacío y para normas europeas", () => {
    expect(siglaOfNorma("")).toBeNull();
    expect(siglaOfNorma("Directiva 93/13/CE")).toBeNull();
    expect(siglaOfNorma("Reglamento (CE) 1234/2008")).toBeNull();
    expect(siglaOfNorma("Sentencia del TSJE")).toBeNull();
  });
});
