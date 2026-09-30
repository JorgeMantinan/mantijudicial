import { describe, expect, it } from "vitest";
import { assessExtraction } from "./extract_quality.js";

function page(lines: string[]): { lines: string[] } {
  return { lines };
}

describe("assessExtraction", () => {
  it("acepta una sentencia con texto normal", () => {
    const pages = Array.from({ length: 8 }, () => page([("palabra ".repeat(80)).trim()]));
    const quality = assessExtraction(pages);
    expect(quality.hasText).toBe(true);
    expect(quality.charsPerPage).toBeGreaterThan(100);
    expect(quality.reason).toBeNull();
  });

  it("rechaza un PDF escaneado (imagen sin texto)", () => {
    const pages = Array.from({ length: 12 }, () => page(["JURISPRUDENCIA", ""]));
    const quality = assessExtraction(pages);
    expect(quality.hasText).toBe(false);
    expect(quality.reason).toContain("OCR");
    expect(quality.pages).toBe(12);
  });

  it("rechaza un documento vacío", () => {
    const quality = assessExtraction([page([]), page([])]);
    expect(quality.hasText).toBe(false);
    expect(quality.chars).toBe(0);
  });

  it("rechaza un documento sin páginas", () => {
    const quality = assessExtraction([]);
    expect(quality.hasText).toBe(false);
    expect(quality.reason).toBe("sin páginas");
  });
});
