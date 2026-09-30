import fs from "node:fs/promises";
import path from "node:path";
import { createAIProvider, type AIProvider } from "./lib/ai_provider.js";
import {
  PROMPT_VERSION,
  SECTION_FILES,
  buildReviewRecord,
  enrichmentCoreSchema,
  sectionFilesWithCaseId,
  type EnrichmentCore,
} from "./lib/enrich_schema.js";
import { extractJson } from "./lib/json_extract.js";
import { buildManifest, saveManifest, scanCases } from "./lib/manifest.js";
import { normalizeEnrichmentInput } from "./lib/normalize.js";
import { REPO_ROOT, caseDir } from "./lib/paths.js";
import { buildEnrichmentPrompt } from "./lib/prompt.js";
import { caseMetadataSchema } from "./lib/schema.js";

const DEFAULT_MODEL = "opencode-go/mimo-v2.6-flash";

interface EnrichArgs {
  cases: string[] | null;
  limit: number | null;
  force: boolean;
  model: string;
  timeoutMs: number;
  retries: number;
  concurrency: number;
}

function parseArgs(argv: string[]): EnrichArgs {
  let cases: string[] | null = null;
  let limit: number | null = null;
  let force = false;
  let model = DEFAULT_MODEL;
  let timeoutMs = 900_000;
  let retries = 2;
  let concurrency = 1;

  for (const arg of argv) {
    if (arg === "--force") force = true;
    const casesMatch = arg.match(/^--cases=(.+)$/);
    if (casesMatch?.[1]) cases = casesMatch[1].split(",").map((name) => name.trim()).filter(Boolean);
    const limitMatch = arg.match(/^--limit=(\d+)$/);
    if (limitMatch?.[1]) limit = Number(limitMatch[1]);
    const modelMatch = arg.match(/^--model=(.+)$/);
    if (modelMatch?.[1]) model = modelMatch[1];
    const timeoutMatch = arg.match(/^--timeout=(\d+)$/);
    if (timeoutMatch?.[1]) timeoutMs = Number(timeoutMatch[1]);
    const retriesMatch = arg.match(/^--retries=(\d+)$/);
    if (retriesMatch?.[1]) retries = Number(retriesMatch[1]);
    const concurrencyMatch = arg.match(/^--concurrency=(\d+)$/);
    if (concurrencyMatch?.[1]) concurrency = Math.max(1, Number(concurrencyMatch[1]));
  }
  return { cases, limit, force, model, timeoutMs, retries, concurrency };
}

async function moveLegacyStructured(casePath: string): Promise<void> {
  const structuredDir = path.join(casePath, "structured");
  const keep = new Set<string>([...Object.values(SECTION_FILES), "review.json"]);
  let entries: string[];
  try {
    entries = await fs.readdir(structuredDir);
  } catch {
    return;
  }
  const legacy = entries.filter((name) => name.endsWith(".json") && !keep.has(name));
  if (legacy.length === 0) return;
  const legacyDir = path.join(structuredDir, "legacy_v1");
  await fs.mkdir(legacyDir, { recursive: true });
  for (const name of legacy) {
    await fs.rename(path.join(structuredDir, name), path.join(legacyDir, name));
    process.stdout.write(`  legacy: structured/${name} -> structured/legacy_v1/\n`);
  }
}

async function updateMetadataClassification(
  casePath: string,
  classification: { civil_branch: string; finality_status: string },
): Promise<void> {
  const metadataDir = path.join(casePath, "metadata");
  const files = (await fs.readdir(metadataDir)).filter((name) => name.endsWith(".json"));
  const fileName = files[0];
  if (!fileName) return;
  const filePath = path.join(metadataDir, fileName);
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    const parsed = caseMetadataSchema.safeParse(raw);
    if (!parsed.success) return;
    const metadata = parsed.data;
    let changed = false;
    if (metadata.civil_branch === "UNKNOWN" && classification.civil_branch) {
      metadata.civil_branch = classification.civil_branch;
      changed = true;
    }
    if (metadata.finality_status === "UNKNOWN" && classification.finality_status) {
      metadata.finality_status = classification.finality_status;
      changed = true;
    }
    if (changed) {
      await fs.writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    }
  } catch {
  }
}

async function writeReview(casePath: string, review: unknown): Promise<void> {
  await fs.mkdir(path.join(casePath, "structured"), { recursive: true });
  await fs.writeFile(
    path.join(casePath, "structured", "review.json"),
    `${JSON.stringify(review, null, 2)}\n`,
    "utf8",
  );
}

async function writeCoreFiles(
  casePath: string,
  caseId: string,
  core: EnrichmentCore,
): Promise<void> {
  const files = sectionFilesWithCaseId(core, caseId);
  const structuredDir = path.join(casePath, "structured");
  await fs.mkdir(structuredDir, { recursive: true });
  for (const [fileName, content] of Object.entries(files)) {
    await fs.writeFile(
      path.join(structuredDir, fileName),
      `${JSON.stringify(content, null, 2)}\n`,
      "utf8",
    );
  }
  await updateMetadataClassification(casePath, core.classification);
  await fs.rm(path.join(structuredDir, "_failed"), { recursive: true, force: true });
}

interface PreviousReview {
  extraction?: {
    model?: string;
    generated_at?: string;
    tokens?: { input: number; output: number; total: number } | null;
    cost?: number | null;
  };
}

async function salvageCase(
  providerName: string,
  target: { caseDir: string; caseId: string },
  args: EnrichArgs,
): Promise<{ ok: boolean; message: string } | null> {
  const path0 = caseDir(target.caseDir);
  const structuredDir = path.join(path0, "structured");
  let raw: string;
  try {
    raw = await fs.readFile(path.join(structuredDir, "_failed", "raw_response.txt"), "utf8");
  } catch {
    return null;
  }

  let core: EnrichmentCore | null = null;
  let errors: string[] = [];
  try {
    const validated = enrichmentCoreSchema.safeParse(normalizeEnrichmentInput(extractJson(raw)));
    if (validated.success) {
      core = validated.data;
    } else {
      errors = validated.error.issues
        .slice(0, 25)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    }
  } catch (error) {
    errors = [String(error)];
  }
  if (core === null) return { ok: false, message: errors[0] ?? "raw ilegible" };

  let inputChars = 0;
  try {
    inputChars = (await fs.readFile(path.join(path0, "extracted", "judgment.txt"), "utf8")).length;
  } catch {
    inputChars = 0;
  }

  let previous: PreviousReview = {};
  try {
    previous = JSON.parse(await fs.readFile(path.join(structuredDir, "review.json"), "utf8")) as PreviousReview;
  } catch {
    previous = {};
  }

  await moveLegacyStructured(path0);
  await writeCoreFiles(path0, target.caseId, core);

  const review = buildReviewRecord({
    caseId: target.caseId,
    provider: providerName,
    model: previous.extraction?.model ?? args.model,
    inputChars,
    tokens: previous.extraction?.tokens ?? null,
    cost: previous.extraction?.cost ?? null,
    validation: "OK",
    schemaErrors: [],
  });
  if (previous.extraction?.generated_at) {
    review.extraction.generated_at = previous.extraction.generated_at;
  }
  review.review.notes =
    "recuperado del raw_response fallido con la normalizacion post-proceso (sin nueva llamada IA)";
  await writeReview(path0, review);

  return {
    ok: true,
    message: `parties=${core.parties.length} facts=${core.facts.length} rama=${core.classification.civil_branch}`,
  };
}

async function enrichCase(
  provider: AIProvider,
  target: { caseDir: string; caseId: string },
  args: EnrichArgs,
): Promise<{ ok: boolean; tokens: number | null; cost: number | null; message: string }> {
  const path0 = caseDir(target.caseDir);
  const judgmentPath = path.join(path0, "extracted", "judgment.txt");

  let judgmentText: string;
  try {
    judgmentText = await fs.readFile(judgmentPath, "utf8");
  } catch {
    return {
      ok: false,
      tokens: null,
      cost: null,
      message: "sin extracted/judgment.txt (¿PDF escaneado? hace falta OCR)",
    };
  }
  if (judgmentText.trim().length < 500) {
    return {
      ok: false,
      tokens: null,
      cost: null,
      message: "texto demasiado corto (¿PDF escaneado? hace falta OCR)",
    };
  }

  await moveLegacyStructured(path0);

  const prompt = buildEnrichmentPrompt(target.caseId);
  const maxAttempts = args.retries + 1;
  let attempts = 0;
  let lastErrorKind: "AI_FAILED" | "SCHEMA_FAILED" = "AI_FAILED";
  let lastErrors: string[] = [];
  let lastRaw = "";
  let accTokens = { input: 0, output: 0, total: 0 };
  let gotTokens = false;
  let accCost = 0;
  let gotCost = false;
  let core: ReturnType<typeof enrichmentCoreSchema.parse> | null = null;

  while (attempts < maxAttempts && core === null) {
    attempts += 1;
    let result: Awaited<ReturnType<AIProvider["run"]>>;
    try {
      result = await provider.run({
        prompt,
        files: [judgmentPath],
        model: args.model,
        timeoutMs: args.timeoutMs,
        cwd: REPO_ROOT,
      });
    } catch (error) {
      lastErrorKind = "AI_FAILED";
      lastErrors = [String(error)];
      process.stdout.write(`  intento ${attempts}/${maxAttempts}: fallo del proveedor IA\n`);
      continue;
    }

    if (result.tokens) {
      accTokens.input += result.tokens.input;
      accTokens.output += result.tokens.output;
      accTokens.total += result.tokens.total;
      gotTokens = true;
    }
    if (result.cost !== null) {
      accCost += result.cost;
      gotCost = true;
    }
    lastRaw = result.text;

    try {
      const parsed = extractJson(result.text);
      const validated = enrichmentCoreSchema.safeParse(normalizeEnrichmentInput(parsed));
      if (validated.success) {
        core = validated.data;
        break;
      }
      lastErrorKind = "SCHEMA_FAILED";
      lastErrors = validated.error.issues
        .slice(0, 25)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      process.stdout.write(
        `  intento ${attempts}/${maxAttempts}: esquema con ${lastErrors.length} incidencias (${lastErrors[0] ?? ""})\n`,
      );
    } catch (error) {
      lastErrorKind = "SCHEMA_FAILED";
      lastErrors = [String(error)];
      const failedDir = path.join(path0, "structured", "_failed");
      await fs.mkdir(failedDir, { recursive: true });
      await fs.writeFile(path.join(failedDir, "raw_response.txt"), result.text, "utf8");
      process.stdout.write(`  intento ${attempts}/${maxAttempts}: JSON ilegible\n`);
    }
  }

  const finalTokens = gotTokens ? accTokens : null;
  const finalCost = gotCost ? accCost : null;

  if (core === null) {
    if (lastRaw) {
      const failedDir = path.join(path0, "structured", "_failed");
      await fs.mkdir(failedDir, { recursive: true });
      await fs.writeFile(path.join(failedDir, "raw_response.txt"), lastRaw, "utf8");
    }
    const review = buildReviewRecord({
      caseId: target.caseId,
      provider: provider.name,
      model: args.model,
      inputChars: judgmentText.length,
      tokens: finalTokens,
      cost: finalCost,
      validation: lastErrorKind,
      schemaErrors: lastErrors,
    });
    await writeReview(path0, review);
    return {
      ok: false,
      tokens: finalTokens?.total ?? null,
      cost: finalCost,
      message: `${lastErrorKind} tras ${attempts} intentos: ${lastErrors[0] ?? ""}`,
    };
  }

  await writeCoreFiles(path0, target.caseId, core);

  const review = buildReviewRecord({
    caseId: target.caseId,
    provider: provider.name,
    model: args.model,
    inputChars: judgmentText.length,
    tokens: finalTokens,
    cost: finalCost,
    validation: "OK",
    schemaErrors: [],
  });
  await writeReview(path0, review);

  return {
    ok: true,
    tokens: finalTokens?.total ?? null,
    cost: finalCost,
    message: `intentos=${attempts} parties=${core.parties.length} claims=${core.claims.length} facts=${core.facts.length} args=${core.arguments.length} holdings=${core.reasoning.length} leyes=${core.cited_laws.length} juris=${core.cited_case_law.length} issues=${core.issues.length} rama=${core.classification.civil_branch} casacion=${core.outcome.cassation_outcome}`,
  };
}

type Entry = Awaited<ReturnType<typeof scanCases>>[number];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = createAIProvider();
  let entries = await scanCases();

  const selectTargets = (list: Entry[]): Entry[] => {
    let selected: Entry[];
    if (args.cases) {
      const wanted = new Set(args.cases);
      selected = list.filter((entry) => wanted.has(entry.caseDir));
      const missing = [...wanted].filter((name) => !list.some((entry) => entry.caseDir === name));
      if (missing.length > 0) {
        process.stderr.write(`Casos no encontrados: ${missing.join(", ")}\n`);
        process.exitCode = 1;
        return [];
      }
    } else {
      selected = list.filter((entry) => entry.duplicateOf === null);
      if (args.limit !== null) selected = selected.slice(0, args.limit);
    }
    if (!args.force) selected = selected.filter((entry) => !entry.enriched);
    return selected;
  };

  let targets = selectTargets(entries);
  if (process.exitCode) return;

  let salvaged = 0;
  for (const entry of targets) {
    const result = await salvageCase(
      provider.name,
      { caseDir: entry.caseDir, caseId: entry.caseId },
      args,
    );
    if (result?.ok) {
      salvaged += 1;
      process.stdout.write(`${entry.caseDir}: RECUPERADO del raw fallido (${result.message})\n`);
    }
  }
  if (salvaged > 0) {
    entries = await scanCases();
    targets = selectTargets(entries);
  }

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let totalTokens = 0;
  let totalCost = 0;

  process.stdout.write(`Proveedor: ${provider.name} | Modelo: ${args.model}\n`);
  process.stdout.write(`Casos objetivo: ${targets.length} | Concurrencia: ${args.concurrency}\n\n`);

  const queue = [...targets];
  const worker = async (): Promise<void> => {
    for (;;) {
      const entry = queue.shift();
      if (!entry) return;
      if (entry.enriched && !args.force) {
        skipped += 1;
        continue;
      }
      const started = Date.now();
      const result = await enrichCase(
        provider,
        { caseDir: entry.caseDir, caseId: entry.caseId },
        args,
      );
      const seconds = Math.round((Date.now() - started) / 1000);
      if (result.ok) ok += 1;
      else failed += 1;
      if (result.tokens) totalTokens += result.tokens;
      if (result.cost) totalCost += result.cost;
      const costStr = result.cost !== null ? ` $${result.cost.toFixed(4)}` : "";
      process.stdout.write(
        `${entry.caseDir}: ${result.ok ? "OK" : "FALLO"} (${seconds}s${costStr}) ${result.message}\n`,
      );
    }
  };

  const workers = Array.from({ length: Math.min(args.concurrency, targets.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  const manifest = buildManifest(await scanCases());
  await saveManifest(manifest);

  process.stdout.write("\n== FASE C2: ENRIQUECIMIENTO IA ==\n");
  process.stdout.write(`Recuperados de raws previos: ${salvaged}\n`);
  process.stdout.write(`Correctos: ${ok}\n`);
  process.stdout.write(`Fallidos: ${failed}\n`);
  process.stdout.write(`Omitidos: ${skipped}\n`);
  process.stdout.write(`Enriquecidos en total: ${manifest.enriched}/${manifest.totalCases}\n`);
  process.stdout.write(`Tokens totales: ${totalTokens}\n`);
  process.stdout.write(`Coste total: $${totalCost.toFixed(4)}\n`);
  process.stdout.write(`Prompt version: ${PROMPT_VERSION}\n`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
