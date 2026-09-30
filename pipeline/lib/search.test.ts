import { describe, expect, it } from "vitest";
import { buildIndex, foldPreservingLength, search, tokenize, type SearchDoc } from "./search.js";

function doc(overrides: Partial<SearchDoc>): SearchDoc {
  return {
    id: "d1",
    kind: "case",
    title: "Sin título",
    body: "",
    meta: {},
    ...overrides,
  };
}

const CORPUS: SearchDoc[] = [
  doc({
    id: "case_000034",
    kind: "case",
    title: "Nulidad de la cláusula suelo y novación en préstamo hipotecario",
    body: "El Tribunal Supremo estima la casación sobre la validez de la novación de la cláusula suelo y el alcance de la restitución de cantidades cobradas indebidamente.",
    meta: { branch: "CONSUMER_ABUSIVE_CLAUSES", outcome: "ESTIMED" },
  }),
  doc({
    id: "case_000002",
    kind: "case",
    title: "Resolución contractual por impago de precio",
    body: "La resolución del contrato exige incumplimiento esencial. Se aplican los artículos 1124 y 1258 del Código Civil sobre buena fe contractual.",
    meta: { branch: "CONTRACTUAL", outcome: "DISMISSED" },
  }),
  doc({
    id: "case_000034#HOLD-001",
    kind: "holding",
    title: "novación cláusula suelo",
    body: "La cuestión planteada en este recurso ha sido ya resuelta en la jurisprudencia establecida a partir de las sentencias 580 y 581/2020.",
    meta: { case: "case_000034", outcome: "ESTIMED" },
  }),
  doc({
    id: "BOE-A-1889-4763#art1124",
    kind: "article",
    title: "Art 1124 · BOE-A-1889-4763",
    body: "Código Civil. La facultad de resolver las obligaciones se entiende implícita en las recíprocas, para el caso de que uno de los obligados no cumpliere lo que le incumbe.",
    meta: { boe_id: "BOE-A-1889-4763", tipo: "precepto" },
  }),
];

describe("tokenize", () => {
  it("quita acentos, palabras vacías y añade variantes plurales", () => {
    const tokens = tokenize("Las cláusulas de los contratos en el BOE");
    expect(tokens).toContain("clausula");
    expect(tokens).toContain("contratos");
    expect(tokens).toContain("contrato");
    expect(tokens).not.toContain("los");
    expect(tokens).not.toContain("el");
  });

  it("conserva números y siglas", () => {
    expect(tokenize("artículo 1124 LEC 1/2000")).toEqual(
      expect.arrayContaining(["articulo", "1124", "lec", "1", "2000"]),
    );
  });
});

describe("foldPreservingLength", () => {
  it("mantiene la longitud deshaciendo acentos", () => {
    const text = "Cláusula suelo nº 1";
    expect(foldPreservingLength(text)).toHaveLength(text.length);
    expect(foldPreservingLength(text)).toBe("clausula suelo nº 1");
  });
});

describe("search", () => {
  const index = buildIndex(CORPUS);

  it("ordena por relevancia y explica los términos", () => {
    const hits = search(index, "cláusula suelo nulidad");
    expect(hits[0]?.id).toBe("case_000034");
    expect(hits[0]?.matchedTerms).toEqual(expect.arrayContaining(["clausula", "suelo"]));
    expect(hits[0]?.snippet).toContain("cláusula suelo");
  });

  it("aplica bonus por frase exacta", () => {
    const hits = search(index, "la cuestión planteada en este recurso");
    expect(hits.some((hit) => hit.id === "case_000034#HOLD-001" && hit.phraseMatch)).toBe(true);
  });

  it("filtra por tipo y metadatos", () => {
    const onlyArticles = search(index, "resolución obligaciones", { kinds: ["article"] });
    expect(onlyArticles.every((hit) => hit.kind === "article")).toBe(true);

    const dismissed = search(index, "contrato", { filters: { outcome: "DISMISSED" } });
    expect(dismissed.map((hit) => hit.id)).toEqual(["case_000002"]);
  });

  it("aplica el criterio de visibilidad durante la puntuación", () => {
    const hits = search(index, "cláusula suelo", {
      allow: (doc) => doc.id !== "case_000034",
    });
    expect(hits.map((hit) => hit.id)).not.toContain("case_000034");
  });

  it("encuentra artículos por número", () => {
    const hits = search(index, "1124", { kinds: ["article"] });
    expect(hits[0]?.id).toBe("BOE-A-1889-4763#art1124");
  });

  it("devuelve vacío sin términos indexables", () => {
    expect(search(index, "el de la")).toEqual([]);
  });
});
