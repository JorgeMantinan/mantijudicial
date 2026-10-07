import { describe, expect, it } from "vitest";
import { buildEnrichmentPrompt } from "./prompt.js";

describe("buildEnrichmentPrompt", () => {
  const prompt = buildEnrichmentPrompt("case_000034");

  it("termina con el identificador del caso a analizar", () => {
    expect(prompt.endsWith("Caso a analizar: case_000034")).toBe(true);
    expect(buildEnrichmentPrompt("case_000007")).toContain("Caso a analizar: case_000007");
  });

  it("declara exactamente las 12 claves del JSON", () => {
    expect(prompt).toContain("exactamente estas 12");
    const claves = [
      "summary",
      "parties",
      "claims",
      "facts",
      "timeline",
      "arguments",
      "reasoning",
      "cited_laws",
      "cited_case_law",
      "outcome",
      "issues",
      "classification",
    ];
    for (const clave of claves) expect(prompt).toContain(`"${clave}"`);
  });

  it("fija las reglas obligatorias de respuesta", () => {
    expect(prompt).toContain("REGLAS OBLIGATORIAS");
    expect(prompt).toContain("Responde SOLO con el JSON");
    expect(prompt).toContain("No inventes nada");
    expect(buildEnrichmentPrompt("case_000034")).toBe(prompt);
  });
});
