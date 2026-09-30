import fs from "node:fs/promises";
import path from "node:path";
import { aggregate, type CaseSignals, type Patterns } from "./lib/patterns.js";
import { CASES_DIR } from "./lib/paths.js";

const DEFAULT_MIN_SUPPORT = 5;
const DISCLAIMER =
  "Asociaciones observadas en el corpus disponible. No son predicciones ni establecen " +
  "causalidad: solo indican con qué frecuencia aparece un elemento junto a cada resultado. " +
  "La revisión de un abogado es imprescindible.";

interface Args {
  minSupport: number;
}

function parseArgs(argv: string[]): Args {
  let minSupport = DEFAULT_MIN_SUPPORT;
  for (const arg of argv) {
    const match = arg.match(/^--min=(\d+)$/);
    if (match?.[1]) minSupport = Number(match[1]);
  }
  return { minSupport };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function loadSignals(caseName: string): Promise<CaseSignals | null> {
  const dir = path.join(CASES_DIR, caseName, "structured");
  const review = await readJson<{ extraction?: { validation?: string } }>(path.join(dir, "review.json"));
  if (review?.extraction?.validation !== "OK") return null;

  const classification = await readJson<{ classification?: { civil_branch?: string; subtopic?: string } }>(
    path.join(dir, "classification.json"),
  );
  const outcome = await readJson<{
    outcome?: { cassation_outcome?: string; recurring_side?: string };
  }>(path.join(dir, "outcome.json"));
  const claims = await readJson<{ claims?: Array<{ outcome?: string; outcome_scope?: string }> }>(
    path.join(dir, "claims.json"),
  );
  const args = await readJson<{
    arguments?: Array<{ type?: string; side?: string; outcome?: string }>;
  }>(path.join(dir, "arguments.json"));
  const reasoning = await readJson<{ holdings?: Array<{ topic?: string; doctrine?: string }> }>(
    path.join(dir, "reasoning.json"),
  );
  const issues = await readJson<{ issues?: Array<{ topic?: string }> }>(path.join(dir, "issues.json"));
  const lawRefs = await readJson<{
    refs?: Array<{ boe_id?: string | null; norma?: string; status?: string }>;
  }>(path.join(dir, "law_refs.json"));

  if (!outcome?.outcome?.cassation_outcome) return null;

  return {
    caseId: caseName,
    branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    subtopic: classification?.classification?.subtopic ?? "",
    cassation: outcome.outcome.cassation_outcome,
    recurringSide: outcome.outcome.recurring_side ?? "UNKNOWN",
    claims: (claims?.claims ?? []).map((claim) => ({
      outcome: claim.outcome ?? "UNKNOWN",
      scope: claim.outcome_scope ?? "NONE",
    })),
    args: (args?.arguments ?? []).map((argument) => ({
      type: argument.type ?? "UNKNOWN",
      side: argument.side ?? "UNKNOWN",
      outcome: argument.outcome ?? "UNKNOWN",
    })),
    holdings: (reasoning?.holdings ?? []).map((holding) => ({
      topic: holding.topic ?? "",
      doctrine: holding.doctrine ?? "UNKNOWN",
    })),
    issues: (issues?.issues ?? []).map((issue) => ({ topic: issue.topic ?? "" })),
    laws: (lawRefs?.refs ?? []).map((ref) => ({
      boe_id: ref.boe_id ?? null,
      sigla: ref.norma ?? "",
      status: ref.status ?? "UNKNOWN",
    })),
  };
}

function formatGroup(group: { key: string; cases: number; distribution: { counts: Record<string, number> } }): string {
  const counts = Object.entries(group.distribution.counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `${name}=${value}`)
    .join(" ");
  return `  ${String(group.cases).padStart(3)} casos | ${counts.padEnd(46)} | ${group.key}`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const caseNames = (await fs.readdir(CASES_DIR)).filter((name) => name.startsWith("case_")).sort();

  const signals: CaseSignals[] = [];
  for (const caseName of caseNames) {
    const item = await loadSignals(caseName);
    if (item) signals.push(item);
  }

  if (signals.length === 0) {
    process.stderr.write("No hay casos enriquecidos todavía.\n");
    process.exitCode = 1;
    return;
  }

  const patterns = aggregate(signals, args.minSupport);
  const output = {
    generated_at: new Date().toISOString(),
    disclaimer: DISCLAIMER,
    ...patterns,
  };
  await fs.writeFile(
    path.join(CASES_DIR, "patterns.json"),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write("\n== FASE F: PATRONES DEL CORPUS ==\n");
  process.stdout.write(`Casos analizados: ${patterns.cases_analyzed}\n`);
  process.stdout.write(`Soporte mínimo: ${patterns.min_support} casos\n`);
  process.stdout.write(
    `Resultados: ${Object.entries(patterns.outcomes.counts)
      .map(([name, value]) => `${name}=${value}`)
      .join(" ")}\n`,
  );

  process.stdout.write("\nPor rama civil:\n");
  for (const group of patterns.by_branch) process.stdout.write(formatGroup(group) + "\n");

  process.stdout.write("\nPor lado recurrente en casación:\n");
  for (const group of patterns.by_recurring_side) process.stdout.write(formatGroup(group) + "\n");

  process.stdout.write("\nArgumentos por tipo:\n");
  for (const row of patterns.by_argument_type) {
    process.stdout.write(
      `  ${String(row.cases).padStart(3)} casos | ${row.key.padEnd(14)} | ${Object.entries(row.outcomes)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => `${name}=${value}`)
        .join(" ")}\n`,
    );
  }

  process.stdout.write("\nTemas del tribunal (ratio decidendi):\n");
  for (const group of patterns.by_holding_topic.slice(0, 15)) {
    process.stdout.write(formatGroup(group) + "\n");
  }

  process.stdout.write("\nDoctrina/precedentes citados:\n");
  for (const group of patterns.by_doctrine.slice(0, 15)) process.stdout.write(formatGroup(group) + "\n");

  process.stdout.write("\nNormas verificadas citadas:\n");
  for (const law of patterns.by_verified_law.slice(0, 15)) {
    process.stdout.write(
      `  ${String(law.cases).padStart(3)} casos | ${law.boe_id} | ${law.siglas.join(", ")} | ${Object.entries(
        law.outcomes,
      )
        .map(([name, value]) => `${name}=${value}`)
        .join(" ")}\n`,
    );
  }
  process.stdout.write(`\nEscrito: cases/patterns.json\n${DISCLAIMER}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
