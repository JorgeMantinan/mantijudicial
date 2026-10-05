import { describe, expect, it } from "vitest";
import { cortar, fechaEs } from "./texto";

describe("fechaEs", () => {
  it("convierte AAAA-MM-DD y AAAAMMDD a DD/MM/AAAA", () => {
    expect(fechaEs("2024-03-05")).toBe("05/03/2024");
    expect(fechaEs("20240305")).toBe("05/03/2024");
  });

  it("devuelve el valor original si no es fecha y '—' si falta", () => {
    expect(fechaEs("no-es-fecha")).toBe("no-es-fecha");
    expect(fechaEs(null)).toBe("—");
    expect(fechaEs(undefined)).toBe("—");
    expect(fechaEs("")).toBe("—");
  });
});

describe("cortar", () => {
  it("recorta con elípsis y deja pasar lo corto", () => {
    expect(cortar("abcdef", 3)).toBe("abc…");
    expect(cortar("abc", 3)).toBe("abc");
    expect(cortar("")).toBe("");
  });
});
