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

  it("detecta referencias de artículo en plural (arts. / artículos)", () => {
    // Casos reales del corpus que el detector anterior no veía.
    expect(
      detectSiglasInText("con base en los arts. 1089 y ss., 1124 y 1254 y ss. del Código Civil"),
    ).toContain("CC");
    expect(
      detectSiglasInText("«Infracción de los artículos 325 y 326 del Código de Comercio.»"),
    ).toContain("CCom");
    expect(
      detectSiglasInText(
        "INFRACCION DE LOS ARTICULOS 80.1 Y 82 DE LA LEY GENERAL PARA LA DEFENSA DE LOS CONSUMIDORES Y USUARIOS",
      ),
    ).toContain("LGDCU");
  });

  it("no confunde los sufijos europeos ni las palabras en minúscula con la CE", () => {
    expect(
      detectSiglasInText("Se aplica el Reglamento (CE) n.º 593/2008 del Parlamento Europeo."),
    ).not.toContain("CE");
    expect(detectSiglasInText("Directiva 2001/24/CE del Parlamento Europeo y del Consejo.")).not.toContain(
      "CE",
    );
    // Salto de línea del extractor entre la barra y la sigla.
    expect(detectSiglasInText("Directiva 2001/24/\nCE del Parlamento Europeo.")).not.toContain("CE");
    // Minúsculas (francés «ce», «ceñirse»): la sigla CE es siempre mayúscula.
    expect(detectSiglasInText("de ce contrat et de ceñirse a lo pactado")).not.toContain("CE");
    expect(detectSiglasInText("Según el artículo 24 CE, en relación con la Constitución Española.")).toContain(
      "CE",
    );
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

  it("reconoce la denominación larga de 1984 y aun así excluye su id", () => {
    expect(detectSiglasInText("anterior (la Ley de Consumidores y Usuarios de 1984).")).toContain(
      "LGDCU",
    );
    expect(
      boeIdsInText("Se aplicó la Ley de Consumidores y Usuarios de 1984 y el artículo 1 LEC."),
    ).toEqual(["BOE-A-2000-323"]);
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
