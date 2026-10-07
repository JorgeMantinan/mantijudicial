import { describe, expect, it } from "vitest";
import { filtrarFrasesDelTema, type GrupoFrasesView } from "./dataset";

/** Grupo de frases como lo devuelve getGruposFrases: totales globales de tres
 * casos, uno de ellos de otro despacho. */
function grupoGlobal(): GrupoFrasesView {
  return {
    origen: "Hechos",
    ejemplo: "Frase que solo aparece en el caso de otro despacho",
    total: 3,
    homogenea: 67,
    distribucion: { ESTIMED: 2, DISMISSED: 1 },
    instancias: [{ instancia: "PRIMERA_INSTANCIA", demandante: 2, demandado: 1, parcial: 1 }],
    ramas: { PROCEDIMIENTO_CIVIL: 2, LABORAL: 1 },
    casos: [
      {
        caseId: "case_000001",
        outcome: "ESTIMED",
        headline: "Asunto propio 1",
        branch: "PROCEDIMIENTO_CIVIL",
        frase: "La nave se encontraba en un parque industrial cerca del incendio",
        decisiones: [{ instance: "PRIMERA_INSTANCIA", result: "FAVOR_PLAINTIFF" }],
      },
      {
        caseId: "case_000002",
        outcome: "ESTIMED",
        headline: "Asunto propio 2",
        branch: "PROCEDIMIENTO_CIVIL",
        frase: "La nave estaba instalada cerca de la propagación del incendio",
        decisiones: [{ instance: "PRIMERA_INSTANCIA", result: "FAVOR_PLAINTIFF" }],
      },
      {
        caseId: "case_999999",
        outcome: "DISMISSED",
        headline: "Asunto ajeno",
        branch: "LABORAL",
        frase: "Frase que solo aparece en el caso de otro despacho",
        decisiones: [
          { instance: "TRABAJADOR", result: "FAVOR_DEFENDANT" },
          { instance: "PRIMERA_INSTANCIA", result: "PARTIAL" },
        ],
      },
    ],
  };
}

describe("filtrarFrasesDelTema", () => {
  it("recalcula ejemplo, totales, ramas e instancias sobre los casos del conjunto", () => {
    const resultado = filtrarFrasesDelTema(
      [grupoGlobal()],
      new Set(["case_000001", "case_000002"]),
    );
    expect(resultado).toHaveLength(1);
    const grupo = resultado[0]!;

    expect(grupo.total).toBe(2);
    expect(grupo.distribucion).toEqual({ ESTIMED: 2 });
    expect(grupo.homogenea).toBe(100);
    expect(grupo.casos.map((caso) => caso.caseId)).toEqual(["case_000001", "case_000002"]);

    // Sin rama ni instancias del caso ajeno.
    expect(grupo.ramas).toEqual({ PROCEDIMIENTO_CIVIL: 2 });
    expect(grupo.instancias).toEqual([
      { instancia: "PRIMERA_INSTANCIA", demandante: 2, demandado: 0, parcial: 0 },
    ]);

    // El ejemplo global venía del caso ajeno: pasa a ser texto de uno propio.
    expect(grupo.ejemplo).toBe("La nave se encontraba en un parque industrial cerca del incendio");
    expect(grupo.casos.some((caso) => caso.frase === grupo.ejemplo)).toBe(true);
  });

  it("descarta el grupo si ninguno de sus casos está en el conjunto", () => {
    expect(filtrarFrasesDelTema([grupoGlobal()], new Set(["case_000042"]))).toEqual([]);
  });

  it("exige dos casos como mínimo (igual que antes del filtro)", () => {
    expect(filtrarFrasesDelTema([grupoGlobal()], new Set(["case_000001"]))).toEqual([]);
  });

  it("respeta el límite de grupos que se pidan", () => {
    const grupos = [grupoGlobal(), { ...grupoGlobal(), ejemplo: "Otra frase de los mismos casos" }];
    const resultado = filtrarFrasesDelTema(
      grupos,
      new Set(["case_000001", "case_000002"]),
      1,
    );
    expect(resultado).toHaveLength(1);
  });
});
