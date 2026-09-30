import { z } from "zod";

export const PROMPT_VERSION = "enrich-v1";

const pageSources = z.array(z.object({ page: z.number().int().positive() }));
const importance = z.number().int().min(1).max(5);
const unknownStr = z.string().default("UNKNOWN");

export const CIVIL_BRANCHES = [
  "CONTRACTUAL",
  "CONSUMER_ABUSIVE_CLAUSES",
  "LEASE_PROPERTY",
  "CIVIL_LIABILITY",
  "PROPERTY_COMMUNITY",
  "FAMILY",
  "SUCCESSIONS",
  "COMMERCIAL",
  "PROCEDURAL",
  "OTHER",
] as const;

const summarySection = z.object({
  headline: z.string(),
  summary: z.string(),
  key_points: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
});

const partySection = z.object({
  party_id: z.string(),
  name: z.string(),
  side: z.enum(["PLAINTIFF", "DEFENDANT", "THIRD_PARTY", "COURT", "OTHER"]),
  kind: z.enum(["PERSON", "COMPANY", "PUBLIC_ENTITY", "OTHER", "UNKNOWN"]),
  representation: z.string().default("UNKNOWN"),
  is_consumer: z.enum(["YES", "NO", "UNKNOWN"]).default("UNKNOWN"),
  notes: z.string().default(""),
  sources: pageSources.default([]),
});

const claimSection = z.object({
  claim_id: z.string(),
  claimant: z.string(),
  side: z.enum(["PLAINTIFF", "DEFENDANT", "UNKNOWN"]),
  description: z.string(),
  outcome: z
    .enum(["GRANTED", "REJECTED", "PARTIALLY_GRANTED", "NOT_ANALYZED", "UNKNOWN"])
    .default("UNKNOWN"),
  outcome_scope: z
    .enum(["FINAL", "FIRST_INSTANCE", "APPEAL", "CASSATION", "NONE"])
    .default("NONE"),
  sources: pageSources.default([]),
});

const factSection = z.object({
  fact_id: z.string(),
  description: z.string(),
  fact_type: z.enum(["FACTUAL", "PROCEDURAL", "JURIDICAL"]).default("FACTUAL"),
  status: z.enum(["PROVEN", "ALLEGED", "DISPUTED", "UNKNOWN"]).default("UNKNOWN"),
  asserted_by: unknownStr,
  importance: importance.default(3),
  sources: pageSources.default([]),
});

const timelineSection = z.object({
  event_id: z.string(),
  date: z.string(),
  date_precision: z.enum(["DAY", "MONTH", "YEAR", "UNKNOWN"]).default("UNKNOWN"),
  description: z.string(),
  event_type: z.enum(["CONTRACT", "PROCEDURAL", "JUDGMENT", "NOTIFICATION", "OTHER"])
    .default("OTHER"),
  sources: pageSources.default([]),
});

const argumentSection = z.object({
  argument_id: z.string(),
  side: z.enum(["PLAINTIFF", "DEFENDANT", "COURT", "OTHER"]),
  author: unknownStr,
  type: z.enum(["LEGAL", "FACTUAL", "PROCEDURAL", "EVIDENTIARY"]).default("LEGAL"),
  description: z.string(),
  legal_basis: z.string().default("UNKNOWN"),
  outcome: z
    .enum(["ACCEPTED", "REJECTED", "PARTIALLY_ACCEPTED", "NOT_ANALYZED", "UNKNOWN"])
    .default("UNKNOWN"),
  importance: importance.default(3),
  sources: pageSources.default([]),
});

const holdingSection = z.object({
  holding_id: z.string(),
  statement: z.string(),
  is_literal_quote: z.boolean().default(false),
  topic: z.string(),
  legal_basis: z.string().default("UNKNOWN"),
  doctrine: z.string().default("UNKNOWN"),
  importance: importance.default(3),
  sources: pageSources.default([]),
});

const citedLawSection = z.object({
  citation_id: z.string(),
  raw_text: z.string(),
  norma: z.string(),
  article: unknownStr,
  boe_id: z.string().default("UNKNOWN"),
  quote: z.string().default("UNKNOWN"),
  relevance: z.enum(["APPLIED", "CITED", "DISCUSSED", "UNKNOWN"]).default("UNKNOWN"),
  sources: pageSources.default([]),
});

const citedCaseLawSection = z.object({
  citation_id: z.string(),
  ref: z.string(),
  date: z.string().default("UNKNOWN"),
  ecli: z.string().default("UNKNOWN"),
  quote: z.string().default("UNKNOWN"),
  role: z.enum(["DOCTRINE_APPLIED", "DISTINGUISHED", "CITED", "UNKNOWN"]).default("UNKNOWN"),
  sources: pageSources.default([]),
});

const outcomeSection = z.object({
  cassation_outcome: z.enum(["ESTIMED", "DISMISSED", "PARTIALLY_ESTIMATED", "UNKNOWN"]),
  recurring_side: z.enum(["PLAINTIFF", "DEFENDANT", "BOTH", "NONE", "UNKNOWN"]),
  decisions: z.array(
    z.object({
      instance: z.enum(["FIRST_INSTANCE", "APPEAL", "CASSATION", "OTHER"]),
      court: z.string(),
      date: z.string().default("UNKNOWN"),
      result: z.enum(["FAVOR_PLAINTIFF", "FAVOR_DEFENDANT", "PARTIAL", "UNKNOWN"]),
      description: z.string(),
      sources: pageSources.default([]),
    }),
  ).default([]),
  claim_outcomes: z
    .array(
      z.object({
        claim_ref: z.string(),
        outcome: z.enum(["GRANTED", "REJECTED", "PARTIALLY_GRANTED", "UNKNOWN"]),
        sources: pageSources.default([]),
      }),
    )
    .default([]),
  reasoning_summary: z.string().default("UNKNOWN"),
});

const issueSection = z.object({
  issue_id: z.string(),
  topic: z.string(),
  description: z.string(),
  importance: importance.default(3),
  sources: pageSources.default([]),
});

const classificationSection = z.object({
  civil_branch: z.enum(CIVIL_BRANCHES),
  subtopic: z.string().default(""),
  finality_status: z.enum(["FIRM", "APPEALED_PENDING", "REVOKED_ON_APPEAL", "UNKNOWN"]).default("UNKNOWN"),
});

export const enrichmentCoreSchema = z.object({
  summary: summarySection,
  parties: z.array(partySection).min(1),
  claims: z.array(claimSection),
  facts: z.array(factSection),
  timeline: z.array(timelineSection),
  arguments: z.array(argumentSection),
  reasoning: z.array(holdingSection),
  cited_laws: z.array(citedLawSection),
  cited_case_law: z.array(citedCaseLawSection),
  outcome: outcomeSection,
  issues: z.array(issueSection),
  classification: classificationSection,
});

export type EnrichmentCore = z.infer<typeof enrichmentCoreSchema>;

export const SECTION_FILES: Record<keyof EnrichmentCore, string> = {
  summary: "summary.json",
  parties: "parties.json",
  claims: "claims.json",
  facts: "facts.json",
  timeline: "timeline.json",
  arguments: "arguments.json",
  reasoning: "reasoning.json",
  cited_laws: "cited_laws.json",
  cited_case_law: "cited_case_law.json",
  outcome: "outcome.json",
  issues: "issues.json",
  classification: "classification.json",
};

export function sectionFilesWithCaseId(
  core: EnrichmentCore,
  caseId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [section, fileName] of Object.entries(SECTION_FILES)) {
    const value = core[section as keyof EnrichmentCore];
    out[fileName] = { case_id: caseId, [sectionKey(section)]: value };
  }
  return out;
}

function sectionKey(section: string): string {
  const map: Record<string, string> = {
    summary: "summary",
    parties: "parties",
    claims: "claims",
    facts: "facts",
    timeline: "events",
    arguments: "arguments",
    reasoning: "holdings",
    cited_laws: "citations",
    cited_case_law: "citations",
    outcome: "outcome",
    issues: "issues",
    classification: "classification",
  };
  return map[section] ?? section;
}

export const reviewSchema = z.object({
  case_id: z.string(),
  extraction: z.object({
    provider: z.string(),
    model: z.string(),
    prompt_version: z.string(),
    generated_at: z.string(),
    input_chars: z.number().int().nonnegative(),
    tokens: z
      .object({
        input: z.number().nonnegative(),
        output: z.number().nonnegative(),
        total: z.number().nonnegative(),
      })
      .nullable(),
    cost: z.number().nullable(),
    validation: z.enum(["OK", "SCHEMA_FAILED", "AI_FAILED"]),
    schema_errors: z.array(z.string()).default([]),
  }),
  review: z.object({
    status: z.enum(["UNREVIEWED", "REVIEWED", "MODIFIED", "REJECTED"]),
    reviewed_by: z.string().nullable(),
    reviewed_at: z.string().nullable(),
    notes: z.string().default(""),
  }),
  golden: z.object({
    isGoldenDataset: z.boolean(),
    groundTruthVersion: z.string().nullable(),
    reviewedBy: z.string().nullable(),
    reviewedAt: z.string().nullable(),
  }),
});

export type ReviewRecord = z.infer<typeof reviewSchema>;

export function buildReviewRecord(input: {
  caseId: string;
  provider: string;
  model: string;
  inputChars: number;
  tokens: { input: number; output: number; total: number } | null;
  cost: number | null;
  validation: "OK" | "SCHEMA_FAILED" | "AI_FAILED";
  schemaErrors?: string[];
}): ReviewRecord {
  return reviewSchema.parse({
    case_id: input.caseId,
    extraction: {
      provider: input.provider,
      model: input.model,
      prompt_version: PROMPT_VERSION,
      generated_at: new Date().toISOString(),
      input_chars: input.inputChars,
      tokens: input.tokens,
      cost: input.cost,
      validation: input.validation,
      schema_errors: input.schemaErrors ?? [],
    },
    review: {
      status: "UNREVIEWED",
      reviewed_by: null,
      reviewed_at: null,
      notes: "",
    },
    golden: {
      isGoldenDataset: false,
      groundTruthVersion: null,
      reviewedBy: null,
      reviewedAt: null,
    },
  });
}
