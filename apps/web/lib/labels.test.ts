import { describe, expect, it } from "vitest";
import { BRANCH, label, OUTCOME } from "./labels";

describe("label", () => {
  it("traduce valores conocidos a castellano", () => {
    expect(label(BRANCH, "CONTRACTUAL")).toBe("Contractual");
    expect(label(OUTCOME, "ESTIMED")).toBe("Estimado");
  });

  it("acepta el valor ya en minúsculas (case-insensitive)", () => {
    expect(label(BRANCH, "contractual")).toBe("Contractual");
  });

  it("usa 'Sin dato' cuando falta y el valor crudo si no hay traducción", () => {
    expect(label(BRANCH, null)).toBe("Sin dato");
    expect(label(BRANCH, undefined)).toBe("Sin dato");
    expect(label(BRANCH, "")).toBe("Sin dato");
    expect(label(BRANCH, "OTRA_COSA")).toBe("OTRA_COSA");
  });
});
