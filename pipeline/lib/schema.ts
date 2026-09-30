import { z } from "zod";

export const caseMetadataSchema = z.object({
  case_id: z.string(),
  source_type: z.string(),
  source: z.string(),
  source_url: z.string(),
  roj: z.string(),
  ecli: z.string(),
  id_cendoj: z.string(),
  court: z.string(),
  court_hierarchy_level: z.string(),
  seat: z.string(),
  section: z.string(),
  resolution_date: z.string(),
  rapporteur: z.string(),
  procedure_type: z.string(),
  appeal_number: z.string(),
  resolution_number: z.string(),
  civil_branch: z.string(),
  finality_status: z.string(),
  retrieval_date: z.string(),
  retrieved_by: z.string(),
  usage_context: z.string(),
  sha256: z.string(),
  search_term_used: z.string(),
});

export type CaseMetadata = z.infer<typeof caseMetadataSchema>;

export interface ManifestPdf {
  fileName: string;
  bytes: number;
  sha256: string;
  title: string | null;
  subject: string | null;
  keywords: string | null;
  roj: string | null;
  ecli: string | null;
  court: string | null;
}

export interface ManifestEntry {
  caseDir: string;
  caseId: string;
  judicialDecisionId: string;
  pdf: ManifestPdf;
  metadataFiles: string[];
  structuredFiles: string[];
  enriched: boolean;
  extracted: {
    judgmentTxt: boolean;
    pagesJson: boolean;
    pageCount: number;
    charCount: number;
  };
  duplicateOf: string | null;
}

export interface Manifest {
  generatedAt: string;
  totalCases: number;
  uniqueDecisions: number;
  duplicates: number;
  processedStructured: number;
  enriched: number;
  withExtractedText: number;
  entries: ManifestEntry[];
}
