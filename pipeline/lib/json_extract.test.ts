import { describe, expect, it } from "vitest";
import { extractJson } from "./json_extract.js";

describe("extractJson", () => {
  it("acepta JSON valido", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("descarta vallas de codigo", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("ignora texto previo al JSON", () => {
    expect(extractJson('Aquí tienes el resultado:\n{"a":1}')).toEqual({ a: 1 });
  });

  it("recorta JSON con texto sobrante al final", () => {
    expect(extractJson('{"a":1}{"b":')).toEqual({ a: 1 });
  });

  it("repara la cerradura malformada de sources", () => {
    const malformed =
      '{"outcome":{"claim_outcomes":[{"sources":[{"page":3]}],"reasoning_summary":"x"}}}';
    expect(extractJson(malformed)).toEqual({
      outcome: { claim_outcomes: [{ sources: [{ page: 3 }] }], reasoning_summary: "x" },
    });
  });

  it("repara la comilla mal puesta en sources", () => {
    expect(extractJson('{"sources":[{"page":4"},{"page":5}]}')).toEqual({
      sources: [{ page: 4 }, { page: 5 }],
    });
  });

  it("recupera el objeto cerrado prematuramente", () => {
    const premature = '{"a":{"b":1},"c":2},"issues":[{"i":1}],"classification":{"x":"y"}}';
    expect(extractJson(premature)).toEqual({
      a: { b: 1 },
      c: 2,
      issues: [{ i: 1 }],
      classification: { x: "y" },
    });
  });

  it("elimina expresiones ternarias filtradas en el JSON", () => {
    const ternary =
      '{"fact_type":"ALLEGED" === "ALLEGED" ? "FACTUAL" : "FACTUAL","status":"ALLEGED"}';
    expect(extractJson(ternary)).toEqual({ fact_type: "FACTUAL", status: "ALLEGED" });
  });

  it("no confunde llaves dentro de cadenas", () => {
    expect(extractJson('{"a":"} } {","b":2}')).toEqual({ a: "} } {", b: 2 });
  });

  it("lanza cuando no hay JSON", () => {
    expect(() => extractJson("no hay nada aqui")).toThrow("JSON valido");
  });
});
