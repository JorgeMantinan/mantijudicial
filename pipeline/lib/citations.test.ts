import { describe, expect, it } from "vitest";
import {
  buildArticleIndex,
  checkQuote,
  corroborationTokens,
  normalizeSigla,
  parseArticleNumbers,
  resolveNorma,
  splitCombinedNorma,
  type NormaRef,
} from "./citations.js";

function ref(
  identificador: string,
  titulo: string,
  ambito = "1",
  vigencia_agotada = "N",
): NormaRef {
  return { identificador, titulo, ambito, vigencia_agotada };
}

const catalog = new Map<string, NormaRef[]>([
  [
    "26/1988",
    [
      ref(
        "BOE-A-1988-123",
        "Ley 26/1988, de 29 de julio, sobre Disciplina e Intervención de las Entidades de Crédito",
      ),
    ],
  ],
  ["1/2000", [ref("BOE-A-2000-323", "Ley 1/2000, de 7 de enero, de Enjuiciamiento Civil")]],
  [
    "5/1994",
    [ref("BOE-A-1994-12665", "Ley 5/1994, de 4 de mayo, de regulación de los servicios de prevención de incendios")],
  ],
  [
    "11/2015",
    [
      ref("BOE-A-2015-9000", "Ley Foral 11/2015 del Impuesto sobre el Valor Añadido de Navarra", "2"),
      ref("BOE-A-2015-4100", "Ley 11/2015, de 18 de junio, de unidad de mercados de valores"),
    ],
  ],
]);

describe("parseArticleNumbers", () => {
  it("lee artículos simples y con apartados", () => {
    expect(parseArticleNumbers("7.1")).toEqual([7]);
    expect(parseArticleNumbers("477.2.3 y 477.3")).toEqual([477]);
    expect(parseArticleNumbers("48.2")).toEqual([48]);
  });

  it("interpreta el punto de millar", () => {
    expect(parseArticleNumbers("1091, 1258 y 1287")).toEqual([1091, 1258, 1287]);
    expect(parseArticleNumbers("1.256")).toEqual([1256]);
    expect(parseArticleNumbers("arts. 1.091, 1.258 y 1.287")).toEqual([1091, 1258, 1287]);
  });

  it("devuelve vacío cuando no hay número", () => {
    expect(parseArticleNumbers("")).toEqual([]);
    expect(parseArticleNumbers("disposición adicional única")).toEqual([]);
  });
});

describe("resolveNorma", () => {
  it("resuelve siglas conocidas", () => {
    expect(resolveNorma("CC", catalog)).toMatchObject({ boe_id: "BOE-A-1889-4763", kind: "sigla" });
    expect(resolveNorma("LEC", catalog)).toMatchObject({ boe_id: "BOE-A-2000-323", kind: "sigla" });
  });

  it("resuelve por número de norma", () => {
    expect(resolveNorma("Ley 26/1988", catalog)).toMatchObject({
      boe_id: "BOE-A-1988-123",
      kind: "numero_oficial",
    });
  });

  it("resuelve cuando la sigla lleva apéndice", () => {
    expect(resolveNorma("LOPJ, disposición adicional 15.ª", catalog)).toMatchObject({
      boe_id: "BOE-A-1985-12666",
      kind: "sigla",
    });
  });

  it("rechaza el número si el texto de la norma no concuerda con la sigla", () => {
    expect(resolveNorma("Circular 5/1994 (BdE)", catalog)).toMatchObject({
      boe_id: null,
      kind: "unknown",
    });
    expect(corroborationTokens("Circular 5/1994 (BdE)")).toEqual(["circular", "bde"]);
  });

  it("prefiere la norma estatal cuando el número es compartido", () => {
    expect(resolveNorma("Ley 11/2015", catalog).boe_id).toBe("BOE-A-2015-4100");
  });

  it("marca como no-BOE el Derecho de la UE", () => {
    expect(resolveNorma("Directiva 93/13/CEE", catalog)).toMatchObject({
      boe_id: null,
      kind: "non_boe",
    });
  });

  it("devuelve unknown para siglas sin mapa", () => {
    expect(resolveNorma("LCGC", catalog)).toMatchObject({ boe_id: null, kind: "unknown" });
  });

  it("no confunde Reglamento Hipotecario con normativa europea", () => {
    const result = resolveNorma("Reglamento Hipotecario", catalog);
    expect(result.kind).toBe("sigla");
    expect(result.boe_id).toBe("BOE-A-1947-3843");
  });

  it("marca como no-BOE los tratados europeos por sigla", () => {
    expect(resolveNorma("TFUE", catalog)).toMatchObject({ boe_id: null, kind: "non_boe" });
  });
});

describe("normalizeSigla y splitCombinedNorma", () => {
  it("limpia paréntesis y puntuación", () => {
    expect(normalizeSigla("LSA (Ley de Sociedades Anónimas)")).toBe("lsa");
  });
  it("separa normas combinadas", () => {
    expect(splitCombinedNorma("LEC / LOPJ")).toEqual(["LEC", "LOPJ"]);
  });

  it("no parte las referencias con números de documento", () => {
    expect(splitCombinedNorma("Directiva 2001/24/CE")).toEqual(["Directiva 2001/24/CE"]);
  });
});

describe("buildArticleIndex", () => {
  it("indexa por título y por id", () => {
    const index = buildArticleIndex([
      { id: "a1", tipo: "precepto", titulo: "Art 1", fecha_vigencia: "", texto: "t" },
      { id: "art1124", tipo: "precepto", titulo: "Art 1124", fecha_vigencia: "", texto: "t" },
      { id: "cii", tipo: "encabezado", titulo: "CAPÍTULO II", fecha_vigencia: "", texto: "t" },
    ]);
    expect(index.get(1)).toBe("a1");
    expect(index.get(1124)).toBe("art1124");
    expect(index.size).toBe(2);
  });
});

describe("checkQuote", () => {
  it("detecta citas textuales presentes", () => {
    const texto = "La facultad de resolver las obligaciones se entiende implícita en las recíprocas";
    expect(checkQuote(texto, "facultad de resolver las obligaciones se entiende implícita")).toBe(
      "MATCH",
    );
  });

  it("tolera diferencias de acentos y espacios", () => {
    const texto = "Las leyes entran en vigor a los veinte dias";
    expect(checkQuote(texto, "las leyes  entran en VIGOR")).toBe("MATCH");
  });

  it("marca mismatch cuando la cita no aparece", () => {
    expect(checkQuote("texto corto", "esta frase no aparece en el articulo bajo ningun criterio")).toBe(
      "MISMATCH",
    );
  });

  it("ignora citas ausentes o demasiado cortas", () => {
    expect(checkQuote("texto", "UNKNOWN")).toBe("NOT_CHECKED");
    expect(checkQuote("texto", "art. 7")).toBe("NOT_CHECKED");
  });
});
