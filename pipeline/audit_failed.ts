import fs from "node:fs/promises";
import path from "node:path";
import { enrichmentCoreSchema } from "./lib/enrich_schema.js";
import { extractJson } from "./lib/json_extract.js";
import { normalizeEnrichmentInput } from "./lib/normalize.js";
import { CASES_DIR } from "./lib/paths.js";

const dirs = (await fs.readdir(CASES_DIR)).sort();
for (const dir of dirs) {
  const file = path.join(CASES_DIR, dir, "structured", "_failed", "raw_response.txt");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    continue;
  }
  let stage = "extract";
  try {
    const parsed = extractJson(raw);
    stage = "schema";
    const result = enrichmentCoreSchema.safeParse(normalizeEnrichmentInput(parsed));
    if (result.success) {
      const core = result.data;
      console.log(
        `${dir}: OK parties=${core.parties.length} facts=${core.facts.length} rama=${core.classification.civil_branch} casacion=${core.outcome.cassation_outcome}`,
      );
    } else {
      const issues = result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(" | ");
      console.log(`${dir}: SCHEMA_FAILED (${stage}): ${issues}`);
    }
  } catch (error) {
    console.log(`${dir}: ${stage}_FAILED: ${String(error)}`);
  }
}
