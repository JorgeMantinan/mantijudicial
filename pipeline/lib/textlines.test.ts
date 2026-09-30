import { describe, expect, it } from "vitest";
import { itemsToLines } from "./textlines.js";

describe("itemsToLines", () => {
  it("agrupa por hasEOL", () => {
    const lines = itemsToLines([
      { str: "Primera", x: 0, y: 100, width: 30, hasEOL: false },
      { str: "linea", x: 32, y: 100, width: 20, hasEOL: true },
      { str: "Segunda", x: 0, y: 90, width: 30, hasEOL: true },
    ]);
    expect(lines).toEqual(["Primera linea", "Segunda"]);
  });

  it("inserta espacio solo si hay hueco", () => {
    const lines = itemsToLines([
      { str: "Art", x: 0, y: 100, width: 10 },
      { str: "1124", x: 10, y: 100, width: 15, hasEOL: true },
      { str: "Art", x: 0, y: 90, width: 10 },
      { str: "1124", x: 13, y: 90, width: 15, hasEOL: true },
    ]);
    expect(lines).toEqual(["Art1124", "Art 1124"]);
  });

  it("recupera la ultima linea sin hasEOL", () => {
    const lines = itemsToLines([{ str: "Final", x: 0, y: 10, width: 20 }]);
    expect(lines).toEqual(["Final"]);
  });
});
