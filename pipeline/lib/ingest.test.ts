import { describe, expect, it } from "vitest";
import { looksLikePdf, nextCaseId, parseIngestArgs, sanitizePdfName } from "./ingest.js";

describe("nextCaseId", () => {
  it("sigue al mayor existente", () => {
    expect(nextCaseId(["case_000001", "case_000079", "case_000012"])).toBe("case_000080");
  });

  it("empieza en 000001 con el corpus vacío", () => {
    expect(nextCaseId([])).toBe("case_000001");
  });

  it("ignora nombres que no son casos", () => {
    expect(nextCaseId(["patterns.json", "manifest.json", "case_000007"])).toBe("case_000008");
  });
});

describe("sanitizePdfName", () => {
  it("quita acentos, espacios y asegura extensión", () => {
    expect(sanitizePdfName("Sentencia nº 12 2026.pdf")).toBe("sentencia_n_12_2026.pdf");
    expect(sanitizePdfName("auto")).toBe("auto.pdf");
  });

  it("conserva solo el nombre base", () => {
    expect(sanitizePdfName("C:\\carpeta\\STS 1234.PDF")).toBe("sts_1234.pdf");
  });
});

describe("looksLikePdf", () => {
  it("reconoce la cabecera PDF", () => {
    expect(looksLikePdf(Buffer.from("%PDF-1.7 y el resto"))).toBe(true);
    expect(looksLikePdf(Buffer.from("esto es texto plano"))).toBe(false);
  });
});

describe("parseIngestArgs", () => {
  it("lee fichero, id y flags", () => {
    const args = parseIngestArgs([
      "--file=C:\\docs\\sentencia.pdf",
      "--id=case_000099",
      "--source=DESPACHO_A",
      "--skip-enrich",
    ]);
    expect(args).toEqual({
      file: "C:\\docs\\sentencia.pdf",
      id: "case_000099",
      source: "DESPACHO_A",
      skipEnrich: true,
      refresh: true,
    });
  });

  it("descarta ids mal formados", () => {
    expect(parseIngestArgs(["--id=81", "--file=a.pdf"]).id).toBeNull();
  });
});
