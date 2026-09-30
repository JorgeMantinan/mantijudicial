import { describe, expect, it } from "vitest";
import { normalizeTitle, resolveNorm, type CatalogNorm } from "./norm_resolver.js";

function norm(overrides: Partial<CatalogNorm>): CatalogNorm {
  return {
    fecha_actualizacion: "20260101T000000Z",
    identificador: "BOE-A-0000-0",
    ambito: { codigo: "1", texto: "Estatal" },
    rango: { codigo: "1", texto: "Ley" },
    numero_oficial: "0/0000",
    titulo: "Sin título",
    fecha_publicacion: "20000101",
    fecha_vigencia: "20000101",
    vigencia_agotada: "N",
    url_html_consolidada: "https://www.boe.es/buscar/act.php?id=BOE-A-0000-0",
    ...overrides,
  };
}

describe("normalizeTitle", () => {
  it("quita acentos, puntuación y normaliza espacios", () => {
    expect(normalizeTitle("Código  de Comercio,  (texto refundido)")).toBe(
      "codigo de comercio texto refundido",
    );
    expect(normalizeTitle("Ley 1/2000, de 7 de enero, de Enjuiciamiento Civil")).toContain(
      "enjuiciamiento civil",
    );
  });
});

describe("resolveNorm", () => {
  it("usa el identificador conocido cuando existe", () => {
    const known = norm({ identificador: "BOE-A-1889-4763", titulo: "Código Civil" });
    const other = norm({ identificador: "BOE-A-9999-1", titulo: "Código Civil de X" });
    const target = { key: "cc", pattern: "codigo civil", known: "BOE-A-1889-4763" };
    expect(resolveNorm(target, [other, known])?.identificador).toBe("BOE-A-1889-4763");
  });

  it("prefiere vigentes, estatales y títulos cortos", () => {
    const agotada = norm({ identificador: "BOE-A-1", titulo: "Ley 29/1994 de Arrendamientos Urbanos", vigencia_agotada: "S" });
    const autonómica = norm({ identificador: "BOE-A-2", titulo: "Ley 29/1994 de Arrendamientos Urbanos", ambito: { codigo: "2", texto: "Autonómico" } });
    const canonica = norm({ identificador: "BOE-A-3", titulo: "Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos" });
    const target = { key: "lau", pattern: "arrendamientos urbanos" };
    expect(resolveNorm(target, [agotada, autonómica, canonica])?.identificador).toBe("BOE-A-3");
  });

  it("aplica el filtro adicional del número de norma", () => {
    const vieja = norm({ identificador: "BOE-A-1", titulo: "Texto Refundido de la Ley de Arrendamientos Urbanos de 1964" });
    const nueva = norm({ identificador: "BOE-A-2", titulo: "Ley 29/1994, de 24 de noviembre, de Arrendamientos Urbanos" });
    const target = { key: "lau", pattern: "arrendamientos urbanos", require: "29/1994" };
    expect(resolveNorm(target, [vieja, nueva])?.identificador).toBe("BOE-A-2");
  });

  it("descarta normas de reforma cuando existe la norma original", () => {
    const reforma = norm({
      identificador: "BOE-A-2017-1",
      titulo: "Real Decreto-ley 18/2017 por el que se modifican el Código de Comercio",
    });
    const original = norm({
      identificador: "BOE-A-1885-1",
      titulo: "Real Decreto de 22 de agosto de 1885 por el que se publica el Código de Comercio",
    });
    const target = { key: "ccom", pattern: "codigo de comercio" };
    expect(resolveNorm(target, [reforma, original])?.identificador).toBe("BOE-A-1885-1");
  });

  it("devuelve null sin coincidencias", () => {
    expect(resolveNorm({ key: "x", pattern: "no existe" }, [norm({})])).toBeNull();
  });
});
