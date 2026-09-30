import { describe, expect, it } from "vitest";
import { parseCendojIdentity, parsePdfHeaderInfo } from "./pdfmeta.js";

function makePdf(title: string, subject: string, keywords: string): Buffer {
  const head = `%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Author (CENDOJ) /Subject (${subject}) /Keywords (${keywords}) /Producer (Apache FOP Version 2.3) >>\nendobj\n`;
  return Buffer.from(head, "latin1");
}

describe("parsePdfHeaderInfo", () => {
  it("lee cabecera y descodifica escapes", () => {
    const info = parsePdfHeaderInfo(makePdf(
      "STS 3643/2026 - ECLI:ES:TS:2026:3643 - Poder Judicial",
      "Tribunal Supremo. Sala de lo Civil - Civil",
      "Jurisprudencia, Tribunal Supremo. Sala de lo Civil, Civil",
    ));
    expect(info.title).toBe("STS 3643/2026 - ECLI:ES:TS:2026:3643 - Poder Judicial");
    expect(info.author).toBe("CENDOJ");
    expect(info.producer).toBe("Apache FOP Version 2.3");
  });

  it("descodifica parentesis escapados", () => {
    const info = parsePdfHeaderInfo(makePdf("Informe \\(v2\\) \\(borrador\\)", "", ""));
    expect(info.title).toBe("Informe (v2) (borrador)");
  });

  it("devuelve null cuando no hay cabecera", () => {
    const info = parsePdfHeaderInfo(Buffer.from("%PDF-1.4\nsin cabecera"));
    expect(info.title).toBeNull();
    expect(info.subject).toBeNull();
  });
});

describe("parseCendojIdentity", () => {
  it("extrae ROJ, ECLI y tribunal", () => {
    const identity = parseCendojIdentity(parsePdfHeaderInfo(makePdf(
      "STS  3643/2026 - ECLI:ES:TS:2026:3643 - Poder Judicial",
      "Tribunal Supremo. Sala de lo Civil - Civil",
      "Jurisprudencia, Tribunal Supremo. Sala de lo Civil, Civil, STS  3643/2026, ES:TS:2026:3643",
    )));
    expect(identity.roj).toBe("STS 3643/2026");
    expect(identity.ecli).toBe("ES:TS:2026:3643");
    expect(identity.court).toBe("Tribunal Supremo. Sala de lo Civil");
  });

  it("devuelve campos nulos sin identificadores", () => {
    const identity = parseCendojIdentity(parsePdfHeaderInfo(makePdf("sin ids", "", "")));
    expect(identity.roj).toBeNull();
    expect(identity.ecli).toBeNull();
  });
});
