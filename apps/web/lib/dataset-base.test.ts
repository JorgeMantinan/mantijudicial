import { describe, expect, it } from "vitest";
import { esCaseId, getCase, isArchived, section } from "./dataset-base";

describe("esCaseId", () => {
  it("acepta el formato case_ con seis dígitos", () => {
    expect(esCaseId("case_000001")).toBe(true);
    expect(esCaseId("case_000000")).toBe(true);
  });

  it("rechaza traversal, tamaños erróneos y mayúsculas", () => {
    expect(esCaseId("../../data/identity")).toBe(false);
    expect(esCaseId("case_1")).toBe(false);
    expect(esCaseId("CASE_000001")).toBe(false);
    expect(esCaseId("")).toBe(false);
    expect(esCaseId("case_000001/../../identity")).toBe(false);
  });
});

describe("section / getCase / isArchived con caseId inválido", () => {
  it("devuelven null o false sin tocar el disco", async () => {
    await expect(section("../../data/identity", "summary.json")).resolves.toBeNull();
    await expect(section("case_1", "summary.json")).resolves.toBeNull();
    await expect(getCase("CASE_000001")).resolves.toBeNull();
    await expect(getCase("")).resolves.toBeNull();
    await expect(isArchived("../../data/identity")).resolves.toBe(false);
    await expect(isArchived("case_1")).resolves.toBe(false);
  });
});
