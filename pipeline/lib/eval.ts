export type PredictedOutcome = "ESTIMED" | "DISMISSED" | "PARTIALLY_ESTIMATED" | "UNKNOWN";

export interface GoldenExpectation {
  cassation_outcome?: PredictedOutcome;
  civil_branch?: string;
  headline_contains?: string;
  must_cite_boe_ids?: string[];
  min_holdings?: number;
  min_facts?: number;
}

export interface GoldenEntry {
  caseId: string;
  expect: GoldenExpectation;
  source: "human" | "auto-rule";
  confirmed: boolean;
  notes?: string;
}

export interface ActualCase {
  caseId: string;
  cassation_outcome: string;
  civil_branch: string;
  headline: string;
  holdings: number;
  facts: number;
  citedBoeIds: string[];
}

import {
  CHECKABLE_SIGLAS,
  boeIdsInText,
  detectSiglasInText,
  siglaOfNorma,
} from "./siglas.js";

export { CHECKABLE_SIGLAS, boeIdsInText, detectSiglasInText, siglaOfNorma };

export interface CitationCheck {
  total: number;
  checkable: number;
  matched: number;
  missingInPdf: Array<{ caseId: string; norma: string; sigla: string }>;
  notCheckable: number;
  pdfOnly: Array<{ caseId: string; siglas: string[] }>;
}

export function checkCitations(
  caseId: string,
  normas: string[],
  text: string,
): { matched: number; checkable: number; missing: string[]; notCheckable: number; pdfOnly: string[] } {
  const inPdf = new Set(detectSiglasInText(text));
  let matched = 0;
  let checkable = 0;
  let notCheckable = 0;
  const missing: string[] = [];
  const cited = new Set<string>();

  for (const norma of normas) {
    const sigla = siglaOfNorma(norma);
    if (!sigla) {
      notCheckable += 1;
      continue;
    }
    checkable += 1;
    cited.add(sigla);
    if (inPdf.has(sigla)) matched += 1;
    else missing.push(norma);
  }

  const pdfOnly = [...inPdf].filter((sigla) => !cited.has(sigla));
  void caseId;
  return { matched, checkable, missing, notCheckable, pdfOnly };
}

export interface FieldResult {  field: string;
  expected: string;
  actual: string;
  ok: boolean;
}

/** Localiza la parte dispositiva: si no, se queda con el tramo final. */
export function falloSection(text: string): string {
  const markers = ["Por todo lo expuesto", "FALLO", "Fallo:", "Por estas"];
  let start = -1;
  for (const marker of markers) {
    const index = text.lastIndexOf(marker);
    if (index > start) start = index;
  }
  if (start >= 0) return text.slice(start);
  return text.slice(Math.floor(text.length * 0.75));
}

function lastIndexMatching(text: string, pattern: RegExp): number {
  let best = -1;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    best = match.index;
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return best;
}

/**
 * El alcance manda: en un fallo es habitual "desestimar el recurso
 * extraordinario y estimar el recurso de casación". Solo se afirma lo que se
 * refiere al recurso de casación; si no aparece, se devuelve UNKNOWN.
 */
export function detectOutcomeFromText(text: string): PredictedOutcome {
  const section = falloSection(text).toLowerCase();
  if (!section.includes("casaci")) return "UNKNOWN";

  const CASACION = /recurso\s+(?:de\s+)?casaci/;
  const estimated = lastIndexMatching(
    section,
    /(?:\bestim\w*\s+(?:el\s+)?recurso\s+(?:de\s+)?casaci)|(?:recurso\s+(?:de\s+)?casaci[\s\S]{0,80}?\bestim\w*)/,
  );
  const dismissed = lastIndexMatching(
    section,
    /(?:\bdesestim\w*\s+(?:el\s+)?recurso\s+(?:de\s+)?casaci)|(?:recurso\s+(?:de\s+)?casaci[\s\S]{0,80}?\bdesestim\w*)/,
  );
  const partial = lastIndexMatching(
    section,
    /(?:\bestim\w*\s+(?:en\s+parte|parcialmente)[\s\S]{0,60}?)?recurso\s+(?:de\s+)?casaci[\s\S]{0,60}?(?:en\s+parte|parcialmente)/,
  );
  void CASACION;

  const best = Math.max(estimated, dismissed);
  if (partial >= 0 && partial >= best) return "PARTIALLY_ESTIMATED";
  if (estimated < 0 && dismissed < 0) return "UNKNOWN";
  if (estimated >= 0 && dismissed >= 0) {
    return estimated >= dismissed ? "ESTIMED" : "DISMISSED";
  }
  return estimated >= 0 ? "ESTIMED" : "DISMISSED";
}

export function compareGolden(entry: GoldenEntry, actual: ActualCase): FieldResult[] {
  const results: FieldResult[] = [];
  const expect = entry.expect;

  if (expect.cassation_outcome) {
    results.push({
      field: "cassation_outcome",
      expected: expect.cassation_outcome,
      actual: actual.cassation_outcome,
      ok: actual.cassation_outcome === expect.cassation_outcome,
    });
  }
  if (expect.civil_branch) {
    results.push({
      field: "civil_branch",
      expected: expect.civil_branch,
      actual: actual.civil_branch,
      ok: actual.civil_branch === expect.civil_branch,
    });
  }
  if (expect.headline_contains) {
    const needle = expect.headline_contains.toLowerCase();
    results.push({
      field: "headline_contains",
      expected: needle,
      actual: actual.headline,
      ok: actual.headline.toLowerCase().includes(needle),
    });
  }
  if (expect.min_holdings !== undefined) {
    results.push({
      field: "min_holdings",
      expected: `>=${expect.min_holdings}`,
      actual: String(actual.holdings),
      ok: actual.holdings >= expect.min_holdings,
    });
  }
  if (expect.min_facts !== undefined) {
    results.push({
      field: "min_facts",
      expected: `>=${expect.min_facts}`,
      actual: String(actual.facts),
      ok: actual.facts >= expect.min_facts,
    });
  }
  for (const boeId of expect.must_cite_boe_ids ?? []) {
    results.push({
      field: `cites:${boeId}`,
      expected: boeId,
      actual: actual.citedBoeIds.includes(boeId) ? boeId : "ausente",
      ok: actual.citedBoeIds.includes(boeId),
    });
  }
  return results;
}

export interface EvalSummary {
  entries: number;
  fields: number;
  passed: number;
  failed: number;
  byField: Record<string, { total: number; passed: number }>;
  failures: Array<{ caseId: string; field: string; expected: string; actual: string; confirmed: boolean }>;
}

export function summarize(results: Array<{ caseId: string; confirmed: boolean; results: FieldResult[] }>): EvalSummary {
  const summary: EvalSummary = {
    entries: results.length,
    fields: 0,
    passed: 0,
    failed: 0,
    byField: {},
    failures: [],
  };
  for (const item of results) {
    for (const result of item.results) {
      summary.fields += 1;
      const bucket = (summary.byField[result.field] ??= { total: 0, passed: 0 });
      bucket.total += 1;
      if (result.ok) {
        summary.passed += 1;
        bucket.passed += 1;
      } else {
        summary.failed += 1;
        summary.failures.push({
          caseId: item.caseId,
          field: result.field,
          expected: result.expected,
          actual: result.actual,
          confirmed: item.confirmed,
        });
      }
    }
  }
  return summary;
}
