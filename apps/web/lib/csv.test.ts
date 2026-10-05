import { describe, expect, it } from "vitest";
import { csv, csvResponse } from "./csv";

describe("csv", () => {
  it("escapa comillas, punto y coma y saltos de línea", () => {
    expect(csv("hola")).toBe("hola");
    expect(csv("a;b")).toBe('"a;b"');
    expect(csv('dijo "no"')).toBe('"dijo ""no"""');
    expect(csv("línea1\nlínea2")).toBe('"línea1\nlínea2"');
  });

  it("neutraliza fórmulas de Excel con ' inicial", () => {
    expect(csv("=1+1")).toBe("'=1+1");
    expect(csv("+SUMA(A1)")).toBe("'+SUMA(A1)");
    expect(csv("@usuario")).toBe("'@usuario");
    expect(csv("-2")).toBe("'-2");
  });
});

describe("csvResponse", () => {
  it("devuelve CSV con BOM y cabeceras de descarga", () => {
    const res = csvResponse("casos.csv", ["a;b", "c"]);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="casos.csv"');
  });

  it("sanea el nombre para no inyectar cabeceras", () => {
    const res = csvResponse('x"; rm -.csv', ["a"]);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="x___rm_-.csv"',
    );
  });
});
