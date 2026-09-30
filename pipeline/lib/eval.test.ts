import { describe, expect, it } from "vitest";
import {
  boeIdsInText,
  checkCitations,
  compareGolden,
  detectOutcomeFromText,
  detectSiglasInText,
  falloSection,
  siglaOfNorma,
  summarize,
  type ActualCase,
  type GoldenEntry,
} from "./eval.js";

const FALLO_ESTIMADO = `
Antecedentes: el juzgado estimó la demanda.
FALLO
Por todo lo expuesto, en nombre del Rey, que decretamos: que debemos ESTIMAR Y ESTIMAMOS el
recurso de casación interpuesto, casando la sentencia de la Audiencia.
`;

const FALLO_DESESTIMADO = `
Por todo lo expuesto, debemos DESESTIMAR Y DESESTIMAMOS el recurso de casación, con costas.
`;

const FALLO_PARCIAL = `
Por todo lo expuesto, estimamos EN PARTE el recurso de casación, casando parcialmente la sentencia.
`;

describe("falloSection", () => {
  it("localiza la parte dispositiva", () => {
    expect(falloSection(FALLO_ESTIMADO)).toContain("debemos ESTIMAR");
    expect(falloSection("texto inicial ".repeat(200) + "Por todo lo expuesto, fallo")).toContain(
      "Por todo lo expuesto",
    );
  });

  it("si no hay marcador, se queda con el final", () => {
    const text = "a".repeat(4000) + "final del documento";
    expect(falloSection(text)).toContain("final del documento");
  });
});

describe("detectOutcomeFromText", () => {
  it("detecta estimación", () => {
    expect(detectOutcomeFromText(FALLO_ESTIMADO)).toBe("ESTIMED");
  });

  it("detecta desestimación", () => {
    expect(detectOutcomeFromText(FALLO_DESESTIMADO)).toBe("DISMISSED");
  });

  it("detecta estimación parcial", () => {
    expect(detectOutcomeFromText(FALLO_PARCIAL)).toBe("PARTIALLY_ESTIMATED");
  });

  it("devuelve UNKNOWN cuando no hay pronunciamiento claro", () => {
    expect(detectOutcomeFromText("el tribunal se pronunciará en sentencia futura")).toBe("UNKNOWN");
  });

  it("no confunde la mención del juzgado con el fallo del TS", () => {
    const text = `El juzgado ESTIMÓ la demanda.\nPor todo lo expuesto, DESESTIMAMOS el recurso de casación.`;
    expect(detectOutcomeFromText(text)).toBe("DISMISSED");
  });

  it("distingue la infracción procesal de la casación", () => {
    const text = `Por todo lo expuesto: 1.º Desestimar el recurso extraordinario por infracción procesal y 2.º Estimar el recurso de casación interpuesto por la parte.`;
    expect(detectOutcomeFromText(text)).toBe("ESTIMED");
  });

  it("si solo se desestima la casación, es DISMISSED", () => {
    const text = `Por todo lo expuesto, debemos y desestimamos el recurso de casación interpuesto, con costas.`;
    expect(detectOutcomeFromText(text)).toBe("DISMISSED");
  });
});

function actual(overrides: Partial<ActualCase>): ActualCase {
  return {
    caseId: "case_000034",
    cassation_outcome: "ESTIMED",
    civil_branch: "CONSUMER_ABUSIVE_CLAUSES",
    headline: "Nulidad de la cláusula suelo",
    holdings: 9,
    facts: 10,
    citedBoeIds: ["BOE-A-1889-4763"],
    ...overrides,
  };
}

describe("compareGolden", () => {
  const entry: GoldenEntry = {
    caseId: "case_000034",
    expect: {
      cassation_outcome: "ESTIMED",
      civil_branch: "CONSUMER_ABUSIVE_CLAUSES",
      headline_contains: "cláusula suelo",
      must_cite_boe_ids: ["BOE-A-1889-4763", "BOE-A-2000-323"],
      min_holdings: 5,
    },
    source: "human",
    confirmed: true,
  };

  it("marca cada campo con acierto o fallo", () => {
    const results = compareGolden(entry, actual({}));
    const byField = Object.fromEntries(results.map((item) => [item.field, item.ok]));
    expect(byField.cassation_outcome).toBe(true);
    expect(byField.civil_branch).toBe(true);
    expect(byField.headline_contains).toBe(true);
    expect(byField.min_holdings).toBe(true);
    expect(byField["cites:BOE-A-1889-4763"]).toBe(true);
    expect(byField["cites:BOE-A-2000-323"]).toBe(false);
  });

  it("detecta salida equivocada", () => {
    const results = compareGolden(entry, actual({ cassation_outcome: "DISMISSED" }));
    expect(results.find((item) => item.field === "cassation_outcome")?.ok).toBe(false);
  });
});

describe("summarize", () => {
  it("acumula totales, tasa por campo y fallos", () => {
    const summary = summarize([
      {
        caseId: "c1",
        confirmed: true,
        results: compareGolden(
          { caseId: "c1", expect: { cassation_outcome: "ESTIMED" }, source: "human", confirmed: true },
          actual({}),
        ),
      },
      {
        caseId: "c2",
        confirmed: false,
        results: compareGolden(
          { caseId: "c2", expect: { cassation_outcome: "DISMISSED" }, source: "auto-rule", confirmed: false },
          actual({ caseId: "c2" }),
        ),
      },
    ]);
    expect(summary.entries).toBe(2);
    expect(summary.fields).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.byField.cassation_outcome).toEqual({ total: 2, passed: 1 });
    expect(summary.failures[0]?.confirmed).toBe(false);
  });
});

describe("siglaOfNorma", () => {
  it("normaliza siglas y nombres largos", () => {
    expect(siglaOfNorma("CC")).toBe("CC");
    expect(siglaOfNorma("Código Civil")).toBe("CC");
    expect(siglaOfNorma("Ley de Enjuiciamiento Civil")).toBe("LEC");
    expect(siglaOfNorma("LOPJ (LO 6/1985)")).toBe("LOPJ");
    expect(siglaOfNorma("CCom")).toBe("CCom");
  });

  it("devuelve null para lo no comprobable", () => {
    expect(siglaOfNorma("Directiva 93/13/CEE")).toBe(null);
    expect(siglaOfNorma("Directiva 2001/24/CE")).toBe(null);
    expect(siglaOfNorma("Reglamento (CE) 1/2003")).toBe(null);
    expect(siglaOfNorma("")).toBe(null);
    expect(siglaOfNorma("Ley 9/2001 (Comunidad de Madrid)")).toBe(null);
  });

  it("no confunde LEC con LECrim", () => {
    expect(siglaOfNorma("LECrim")).toBe("LECrim");
    expect(siglaOfNorma("LEC")).toBe("LEC");
  });
});

describe("detectSiglasInText", () => {
  const text =
    "Se aplican el art. 1124 CC y el art. 477 LEC. También el artículo 15 de la LOPJ y la Constitución Española.";

  it("encuentra las siglas presentes", () => {
    const found = detectSiglasInText(text);
    expect(found).toEqual(expect.arrayContaining(["CC", "LEC", "LOPJ", "CE"]));
    expect(found).not.toContain("LPH");
  });

  it("las traduce a identificadores BOE para el golden", () => {
    expect(boeIdsInText(text)).toEqual(
      expect.arrayContaining(["BOE-A-1889-4763", "BOE-A-2000-323", "BOE-A-1985-12666"]),
    );
    expect(boeIdsInText("sin normas citadas")).toEqual([]);
  });

  it("no espera la norma de consumidores si el caso cita la Ley 26/1984", () => {
    expect(boeIdsInText("art. 2 LGDCU conforme a la Ley 26/1984")).toEqual([]);
    expect(boeIdsInText("art. 8 LGDCU")).toEqual(["BOE-A-2007-20555"]);
  });
});

describe("checkCitations", () => {
  it("separa lo comprobable, lo coincidente y lo ausente", () => {
    const result = checkCitations(
      "case_000001",
      ["CC", "LEC", "LPH", "Directiva 93/13/CEE"],
      "Art. 1124 del Código Civil. Arts. 398 y 469 LEC.",
    );
    expect(result.checkable).toBe(3);
    expect(result.matched).toBe(2);
    expect(result.missing).toEqual(["LPH"]);
    expect(result.notCheckable).toBe(1);
  });

  it("detecta siglas que solo están en el PDF", () => {
    const result = checkCitations(
      "case_000002",
      ["CC"],
      "Código Civil, LEC y Propiedad Horizontal (LPH).",
    );
    expect(result.pdfOnly).toEqual(expect.arrayContaining(["LEC", "LPH"]));
  });
});
