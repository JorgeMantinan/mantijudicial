import { describe, expect, it } from "vitest";
import { buildManifest, markDuplicates } from "./manifest.js";
import type { ManifestEntry } from "./schema.js";

function entry(caseDirName: string, ecli: string | null): ManifestEntry {
  return {
    caseDir: caseDirName,
    caseId: `CASE-${caseDirName.replace("case_", "")}`,
    judicialDecisionId: `JD-${caseDirName.replace("case_", "")}`,
    pdf: {
      fileName: "x.pdf",
      bytes: 1,
      sha256: "abc",
      title: null,
      subject: null,
      keywords: null,
      roj: null,
      ecli,
      court: null,
    },
    metadataFiles: [],
    structuredFiles: [],
    enriched: false,
    extracted: { judgmentTxt: false, pagesJson: false, pageCount: 0, charCount: 0 },
    duplicateOf: null,
  };
}

describe("markDuplicates", () => {
  it("marca como duplicado todos menos el primero", () => {
    const entries = [
      entry("case_000010", "ES:TS:2026:3359"),
      entry("case_000012", "ES:TS:2026:3359"),
      entry("case_000001", "ES:TS:2026:1111"),
      entry("case_000009", null),
    ];
    markDuplicates(entries);
    expect(entries[0]?.duplicateOf).toBeNull();
    expect(entries[1]?.duplicateOf).toBe("case_000010");
    expect(entries[2]?.duplicateOf).toBeNull();
    expect(entries[3]?.duplicateOf).toBeNull();
  });
});

describe("buildManifest", () => {
  it("cuenta totales y unicos", () => {
    const entries = [entry("case_000010", "ES:TS:2026:3359"), entry("case_000012", "ES:TS:2026:3359")];
    markDuplicates(entries);
    const manifest = buildManifest(entries);
    expect(manifest.totalCases).toBe(2);
    expect(manifest.uniqueDecisions).toBe(1);
    expect(manifest.duplicates).toBe(1);
  });
});
