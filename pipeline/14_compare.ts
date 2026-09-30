import fs from "node:fs/promises";
import path from "node:path";
import { createAIProvider, type AIProvider } from "./lib/ai_provider.js";
import { extractJson } from "./lib/json_extract.js";
import { CASES_DIR, REPO_ROOT, caseDir } from "./lib/paths.js";
import { buildIndex, search } from "./lib/search.js";
import { loadSignals } from "./lib/signals.js";
import {
  COMPARE_PROMPT_VERSION,
  renderCompareContext,
  buildComparePrompt,
  compareSchema,
  normalizeCompareInput,
  type CaseSignals,
} from "./lib/compare.js";

const DEFAULT_MODEL = "opencode-go/mimo-v2.6-flash";

interface Args {
  primary: string;
  other: string | null;
  model: string;
  force: boolean;
  retries: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { primary: "", other: null, model: DEFAULT_MODEL, force: false, retries: 2 };
  for (const arg of argv) {
    const a = arg.match(/^--a=(.+)$/);
    const b = arg.match(/^--b=(.+)$/);
    const model = arg.match(/^--model=(.+)$/);
    const retries = arg.match(/^--retries=(\d+)$/);
    if (a?.[1]) args.primary = a[1].trim();
    if (b?.[1]) args.other = b[1].trim();
    if (model?.[1]) args.model = model[1];
    if (retries?.[1]) args.retries = Number(retries[1]);
    if (arg === "--force") args.force = true;
    if (/^case_\d{6}$/.test(arg) && !args.primary) args.primary = arg;
    else if (/^case_\d{6}$/.test(arg) && !args.other) args.other = arg;
  }
  return args;
}

async function pickSimilar(primaryId: string): Promise<string | null> {
  const names = (await fs.readdir(CASES_DIR)).filter((name) => /^case_\d{6}$/.test(name));
  const docs: Array<{ id: string; title: string; body: string }> = [];
  for (const name of names) {
    if (name === primaryId) continue;
    const signals = await loadSignals(name);
    if (!signals) continue;
    docs.push({ id: name, title: signals.headline, body: `${signals.summary}\n${signals.issues.join("\n")}` });
  }
  const primary = await loadSignals(primaryId);
  if (!primary) return null;
  const index = buildIndex(docs.map((doc) => ({ ...doc, kind: "case" as const, meta: {} })));
  const hits = search(index, `${primary.headline} ${primary.subtopic} ${primary.issues.join(" ")}`, {
    limit: 1,
  });
  return hits[0]?.id ?? null;
}

async function runCompare(provider: AIProvider, args: Args): Promise<string> {
  const primary = await loadSignals(args.primary);
  if (!primary) throw new Error(`${args.primary}: sin extracción de IA`);
  const otherId = args.other ?? (await pickSimilar(args.primary));
  if (!otherId) throw new Error("No se encontró un caso de referencia");
  const other = await loadSignals(otherId);
  if (!other) throw new Error(`${otherId}: sin extracción de IA`);

  const context = renderCompareContext(primary, other);
  const contextPath = path.join(caseDir(args.primary), "extracted", `compare_${otherId}.txt`);
  await fs.mkdir(path.dirname(contextPath), { recursive: true });
  await fs.writeFile(contextPath, context, "utf8");

  const prompt = buildComparePrompt(args.primary, otherId);
  let attempts = 0;
  let lastError = "";
  let lastRaw = "";

  while (attempts < args.retries + 1) {
    attempts += 1;
    let result: Awaited<ReturnType<AIProvider["run"]>>;
    try {
      result = await provider.run({
        prompt,
        files: [contextPath],
        model: args.model,
        timeoutMs: 900_000,
        cwd: REPO_ROOT,
      });
    } catch (error) {
      lastError = String(error);
      process.stdout.write(`  intento ${attempts}: fallo del proveedor IA\n`);
      continue;
    }
    lastRaw = result.text;
    try {
      const parsed = compareSchema.safeParse(normalizeCompareInput(extractJson(result.text)));
      if (parsed.success) {
        const report = { ...parsed.data, case_id: args.primary, otro_caso: otherId };
        const output = {
          case_id: args.primary,
          otro_caso: otherId,
          analysis: {
            provider: provider.name,
            model: args.model,
            prompt_version: COMPARE_PROMPT_VERSION,
            generated_at: new Date().toISOString(),
            context_chars: context.length,
            tokens: result.tokens,
            cost: result.cost,
            attempts,
          },
          report,
        };
        const outPath = path.join(caseDir(args.primary), "structured", `compare_${otherId}.json`);
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
        return `aplicabilidad=${report.aplicabilidad} similitudes=${report.similitudes.length} diferencias=${report.diferencias.length} argumentos=${report.argumentos_efectivos.length} huecos=${report.huecos.length} contra=${report.contraargumentos.length} intentos=${attempts}`;
      }
      lastError = parsed.error.issues
        .slice(0, 4)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      process.stdout.write(`  intento ${attempts}: esquema incorrecto (${lastError})\n`);
    } catch (error) {
      lastError = String(error);
      process.stdout.write(`  intento ${attempts}: JSON ilegible\n`);
    }
  }

  const failedPath = path.join(caseDir(args.primary), "structured", "compare_failed.txt");
  await fs.mkdir(path.dirname(failedPath), { recursive: true });
  await fs.writeFile(failedPath, `${lastError}\n\n${lastRaw}`, "utf8");
  throw new Error(`fallo tras ${attempts} intentos (${lastError})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.primary) {
    process.stderr.write(
      "Uso: pnpm compare -- --a=case_000034 [--b=case_000037] [--model=X] [--force]\n" +
        "     (sin --b se elige automáticamente el caso más parecido)\n",
    );
    process.exitCode = 1;
    return;
  }

  const other = args.other ?? (await pickSimilar(args.primary));
  const outFile = path.join(caseDir(args.primary), "structured", `compare_${other ?? "x"}.json`);
  const exists = await fs
    .stat(outFile)
    .then(() => true)
    .catch(() => false);
  if (exists && !args.force) {
    process.stdout.write(`Ya existe comparación con ${other} (usa --force para repetir)\n`);
    return;
  }

  const provider = createAIProvider();
  process.stdout.write(`Proveedor: ${provider.name} | Modelo: ${args.model}\n`);
  process.stdout.write(`Comparando ${args.primary} con ${other ?? "(automático)"}…\n`);
  const started = Date.now();
  const message = await runCompare(provider, args);
  process.stdout.write(`OK (${Math.round((Date.now() - started) / 1000)}s) ${message}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
