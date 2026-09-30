import { describe, expect, it } from "vitest";
import { aggregate, distribution, normalizeKey, type CaseSignals } from "./patterns.js";

function makeCase(overrides: Partial<CaseSignals>): CaseSignals {
  return {
    caseId: "case_000001",
    branch: "CONTRACTUAL",
    subtopic: "",
    cassation: "ESTIMED",
    recurringSide: "DEFENDANT",
    claims: [],
    args: [{ type: "LEGAL", side: "DEFENDANT", outcome: "ACCEPTED" }],
    holdings: [{ topic: "buena fe", doctrine: "STS 1/2020" }],
    issues: [{ topic: "transparencia" }],
    laws: [{ boe_id: "BOE-A-1889-4763", sigla: "CC", status: "VERIFIED" }],
    ...overrides,
  };
}

function buildCases(): CaseSignals[] {
  return [
    makeCase({ caseId: "c1", branch: "CONTRACTUAL", cassation: "ESTIMED" }),
    makeCase({ caseId: "c2", branch: "CONTRACTUAL", cassation: "DISMISSED" }),
    makeCase({ caseId: "c3", branch: "CONTRACTUAL", cassation: "ESTIMED" }),
    makeCase({
      caseId: "c4",
      branch: "CONSUMER_ABUSIVE_CLAUSES",
      cassation: "ESTIMED",
      holdings: [{ topic: "cláusula suelo", doctrine: "STS 580/2020" }],
      laws: [{ boe_id: "BOE-A-1889-4763", sigla: "CC", status: "VERIFIED" }],
    }),
    makeCase({
      caseId: "c5",
      branch: "CONSUMER_ABUSIVE_CLAUSES",
      cassation: "DISMISSED",
      holdings: [{ topic: "cláusula suelo", doctrine: "STS 580/2020" }],
      laws: [{ boe_id: null, sigla: "Directiva 93/13/CEE", status: "NON_BOE" }],
    }),
  ];
}

describe("distribution", () => {
  it("cuenta ocurrencias", () => {
    expect(distribution(["A", "B", "A"])).toEqual({ total: 3, counts: { A: 2, B: 1 } });
  });
});

describe("normalizeKey", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normalizeKey("  Cláusula  SUELO ")).toBe("clausula suelo");
  });
});

describe("aggregate", () => {
  const patterns = aggregate(buildCases(), 3);

  it("incluye solo grupos con soporte mínimo", () => {
    expect(patterns.by_branch.map((group) => group.key)).toEqual(["contractual"]);
    expect(patterns.by_branch[0]?.cases).toBe(3);
  });

  it("calcula la proporción de estimaciones", () => {
    expect(patterns.by_branch[0]?.share_estimated).toBe(0.667);
  });

  it("agrupa doctrina por casos, no por menciones", () => {
    expect(patterns.by_doctrine.map((group) => group.key)).toEqual(["sts 1/2020"]);
    expect(patterns.by_doctrine[0]?.cases).toBe(3);
    const withSupport = aggregate(buildCases(), 2);
    const doctrina = withSupport.by_doctrine.find((group) => group.key === "sts 580/2020");
    expect(doctrina?.cases).toBe(2);
    expect(doctrina?.distribution.counts).toEqual({ ESTIMED: 1, DISMISSED: 1 });
  });

  it("solo agrega leyes verificadas", () => {
    const withSupport = aggregate(buildCases(), 2);
    expect(withSupport.by_verified_law).toHaveLength(1);
    expect(withSupport.by_verified_law[0]?.boe_id).toBe("BOE-A-1889-4763");
    expect(withSupport.by_verified_law[0]?.cases).toBe(4);
  });

  it("agrupa temas del tribunal con soporte mínimo", () => {
    const withSupport = aggregate(buildCases(), 2);
    expect(withSupport.by_holding_topic.map((group) => group.key)).toEqual([
      "buena fe",
      "clausula suelo",
    ]);
    expect(withSupport.by_issue[0]?.key).toBe("transparencia");
  });
});
