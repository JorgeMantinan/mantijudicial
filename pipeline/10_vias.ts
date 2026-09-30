import fs from "node:fs/promises";
import path from "node:path";
import { OpencodeCliProvider, type AIProvider } from "./lib/ai_provider.js";
import { buildArticleIndex } from "./lib/citations.js";
import { extractJson } from "./lib/json_extract.js";
import { normalizeViasInput } from "./lib/vias.js";
import { CASES_DIR, LAWS_DIR, REPO_ROOT, caseDir } from "./lib/paths.js";
import { buildIndex, search } from "./lib/search.js";
import {
  VIAS_PROMPT_VERSION,
  buildViasPrompt,
  renderViasContext,
  viasSchema,
  type LawContext,
  type SimilarCaseContext,
  type ViasContext,
} from "./lib/vias.js";

const DEFAULT_MODEL = "opencode-go/mimo-v2.6-flash";
const SIMILAR_LIMIT = 5;

interface Args {
  cases: string[];
  model: string;
  force: boolean;
  retries: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { cases: [], model: DEFAULT_MODEL, force: false, retries: 2 };
  for (const arg of argv) {
    if (arg === "--force") args.force = true;
    const cases = arg.match(/^--cases=(.+)$/);
    if (cases?.[1]) args.cases = cases[1].split(",").map((value) => value.trim()).filter(Boolean);
    const model = arg.match(/^--model=(.+)$/);
    if (model?.[1]) args.model = model[1];
    const retries = arg.match(/^--retries=(\d+)$/);
    if (retries?.[1]) args.retries = Number(retries[1]);
  }
  return args;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function section<T>(caseId: string, file: string): Promise<T | null> {
  return readJson<T>(path.join(CASES_DIR, caseId, "structured", file));
}

interface Ref {
  boe_id?: string | null;
  status?: string;
  articles?: Array<{ number?: number; block_id?: string | null }>;
}

interface Holding {
  topic?: string;
  statement?: string;
  doctrine?: string;
}

interface Argument {
  side?: string;
  type?: string;
  outcome?: string;
  description?: string;
}

async function loadOwnSignals(caseId: string) {
  const [summary, classification, outcome, facts, claims, issues, args, reasoning, lawRefs] =
    await Promise.all([
      section<{ summary?: { headline?: string; summary?: string; key_points?: string[] } }>(caseId, "summary.json"),
      section<{ classification?: { civil_branch?: string; subtopic?: string } }>(caseId, "classification.json"),
      section<{ outcome?: { cassation_outcome?: string; recurring_side?: string } }>(caseId, "outcome.json"),
      section<{ facts?: Array<{ description?: string }> }>(caseId, "facts.json"),
      section<{ claims?: Array<{ description?: string }> }>(caseId, "claims.json"),
      section<{ issues?: Array<{ topic?: string; description?: string }> }>(caseId, "issues.json"),
      section<{ arguments?: Argument[] }>(caseId, "arguments.json"),
      section<{ holdings?: Holding[] }>(caseId, "reasoning.json"),
      section<{ refs?: Ref[] }>(caseId, "law_refs.json"),
    ]);

  return {
    headline: summary?.summary?.headline ?? caseId,
    subtopic: classification?.classification?.subtopic ?? "",
    branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
    recurringSide: outcome?.outcome?.recurring_side ?? "UNKNOWN",
    summary: summary?.summary?.summary ?? "",
    keyPoints: summary?.summary?.key_points ?? [],
    facts: (facts?.facts ?? []).map((fact) => fact.description ?? ""),
    claims: (claims?.claims ?? []).map((claim) => claim.description ?? ""),
    issues: (issues?.issues ?? []).map(
      (issue) => `${issue.topic ?? ""}: ${issue.description ?? ""}`,
    ),
    ownArguments: (args?.arguments ?? []).map(
      (argument) => `[${argument.side ?? "?"}/${argument.type ?? "?"} · ${argument.outcome ?? "?"}] ${argument.description ?? ""}`,
    ),
    lawRefs: lawRefs?.refs ?? [],
    holdings: (reasoning?.holdings ?? []).map(
      (holding) => `[${holding.topic ?? ""}] ${holding.statement ?? ""}`,
    ),
  };
}

async function caseDocsForSearch(): Promise<
  Array<{ id: string; title: string; body: string }>
> {
  const names = (await fs.readdir(CASES_DIR)).filter((name) => /^case_\d{6}$/.test(name));
  const docs: Array<{ id: string; title: string; body: string }> = [];
  for (const name of names) {
    const summary = await section<{ summary?: { headline?: string; summary?: string } }>(name, "summary.json");
    const reasoning = await section<{ holdings?: Holding[] }>(name, "reasoning.json");
    const review = await section<{ extraction?: { validation?: string } }>(name, "review.json");
    if (review?.extraction?.validation !== "OK") continue;
    docs.push({
      id: name,
      title: summary?.summary?.headline ?? name,
      body: [
        summary?.summary?.summary ?? "",
        ...(reasoning?.holdings ?? []).map((holding) => holding.topic ?? ""),
      ].join("\n"),
    });
  }
  return docs;
}

async function loadSimilarCase(id: string): Promise<SimilarCaseContext> {
  const [summary, classification, outcome, reasoning, args, lawRefs] = await Promise.all([
    section<{ summary?: { headline?: string } }>(id, "summary.json"),
    section<{ classification?: { civil_branch?: string; subtopic?: string } }>(id, "classification.json"),
    section<{ outcome?: { cassation_outcome?: string } }>(id, "outcome.json"),
    section<{ holdings?: Holding[] }>(id, "reasoning.json"),
    section<{ arguments?: Argument[] }>(id, "arguments.json"),
    section<{ refs?: Ref[] }>(id, "law_refs.json"),
  ]);
  return {
    id,
    headline: summary?.summary?.headline ?? id,
    subtopic: classification?.classification?.subtopic ?? "",
    branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
    holdings: (reasoning?.holdings ?? [])
      .filter((holding) => Boolean(holding.statement))
      .slice(0, 8)
      .map((holding) => ({
        topic: holding.topic ?? "",
        statement: holding.statement ?? "",
        doctrine: holding.doctrine ?? "UNKNOWN",
      })),
    argumentsList: (args?.arguments ?? [])
      .filter((argument) => Boolean(argument.description))
      .slice(0, 12)
      .map((argument) => ({
        side: argument.side ?? "?",
        type: argument.type ?? "?",
        outcome: argument.outcome ?? "UNKNOWN",
        description: argument.description ?? "",
      })),
    verifiedLaws: (lawRefs?.refs ?? [])
      .filter((ref) => ref.status === "VERIFIED" && ref.boe_id)
      .map((ref) => ref.boe_id as string),
  };
}

async function buildSearchIndex() {
  const docs = await caseDocsForSearch();
  return buildIndex(docs.map((doc) => ({ ...doc, kind: "case" as const, meta: {} })));
}

async function loadLawContexts(refs: Ref[]): Promise<LawContext[]> {
  const byBoe = new Map<string, Set<number>>();
  for (const ref of refs) {
    if (ref.status !== "VERIFIED" || !ref.boe_id) continue;
    const numbers = byBoe.get(ref.boe_id) ?? new Set<number>();
    for (const article of ref.articles ?? []) {
      if (typeof article.number === "number") numbers.add(article.number);
    }
    byBoe.set(ref.boe_id, numbers);
  }

  const out: LawContext[] = [];
  for (const [boeId, numbers] of byBoe) {
    const norm = await readJson<{
      boe_id: string;
      titulo: string;
      blocks: Array<{ id: string; titulo: string; texto: string; tipo: string; fecha_vigencia: string }>;
    }>(path.join(LAWS_DIR, "norms", `${boeId}.json`));
    if (!norm) continue;
    const index = buildArticleIndex(norm.blocks);
    const sigla = siglaFor(norm.titulo);
    const articles: LawContext["articles"] = [];
    for (const number of [...numbers].slice(0, 4)) {
      const blockId = index.get(number);
      const block = blockId ? norm.blocks.find((item) => item.id === blockId) : undefined;
      if (!block) continue;
      articles.push({ number, titulo: block.titulo, texto: block.texto });
    }
    if (articles.length > 0) out.push({ boe_id: boeId, sigla, titulo: norm.titulo, articles });
  }
  return out;
}

function siglaFor(titulo: string): string {
  const known: Array<[RegExp, string]> = [
    [/C[oó]digo Civil/i, "CC"],
    [/Enjuiciamiento Civil/i, "LEC"],
    [/C[oó]digo Penal/i, "CP"],
    [/C[oó]digo de Comercio/i, "CCom"],
    [/Enjuiciamiento Criminal/i, "LECrim"],
    [/Poder Judicial/i, "LOPJ"],
    [/Constituci/i, "CE"],
    [/Arrendamientos Urbanos/i, "LAU"],
    [/Propiedad Horizontal/i, "LPH"],
    [/Consumidores/i, "TRLGDCU"],
    [/Ley Hipotecaria/i, "LH"],
  ];
  for (const [pattern, sigla] of known) if (pattern.test(titulo)) return sigla;
  return titulo.slice(0, 30);
}

async function buildContext(caseId: string): Promise<ViasContext> {
  const own = await loadOwnSignals(caseId);
  const index = await buildSearchIndex();
  const hits = search(
    index,
    [own.headline, own.subtopic, ...own.holdings].join(" "),
    { kinds: ["case"], limit: SIMILAR_LIMIT + 4 },
  ).filter((hit) => hit.id !== caseId);

  const similar: SimilarCaseContext[] = [];
  for (const hit of hits.slice(0, SIMILAR_LIMIT)) {
    similar.push(await loadSimilarCase(hit.id));
  }

  const ownVerified = own.lawRefs.filter((ref) => ref.status === "VERIFIED" && ref.boe_id);
  const similarRefs: Ref[] = [];
  for (const item of similar) {
    const refs = await section<{ refs?: Ref[] }>(item.id, "law_refs.json");
    for (const ref of refs?.refs ?? []) {
      if (ref.status === "VERIFIED" && ref.boe_id) similarRefs.push(ref);
    }
  }

  const laws = await loadLawContexts([...ownVerified, ...similarRefs]);

  return {
    caseId,
    headline: own.headline,
    subtopic: own.subtopic,
    branch: own.branch,
    outcome: own.outcome,
    recurringSide: own.recurringSide,
    summary: own.summary,
    keyPoints: own.keyPoints,
    facts: own.facts,
    claims: own.claims,
    issues: own.issues,
    ownArguments: own.ownArguments,
    similar,
    laws,
  };
}

async function runVias(provider: AIProvider, caseId: string, args: Args): Promise<string> {
  const context = await buildContext(caseId);
  const rendered = renderViasContext(context);
  const contextPath = path.join(caseDir(caseId), "extracted", "vias_context.txt");
  await fs.mkdir(path.dirname(contextPath), { recursive: true });
  await fs.writeFile(contextPath, rendered, "utf8");

  const prompt = buildViasPrompt(caseId);
  const maxAttempts = args.retries + 1;
  let attempts = 0;
  let lastError = "";
  let lastRaw = "";
  let accTokens = { input: 0, output: 0, total: 0 };
  let accCost = 0;

  while (attempts < maxAttempts) {
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
      process.stdout.write(`  intento ${attempts}/${maxAttempts}: fallo del proveedor IA\n`);
      continue;
    }
    if (result.tokens) {
      accTokens.input += result.tokens.input;
      accTokens.output += result.tokens.output;
      accTokens.total += result.tokens.total;
    }
    if (result.cost !== null) accCost += result.cost;
    lastRaw = result.text;

    try {
      const parsed = viasSchema.safeParse(normalizeViasInput(extractJson(result.text)));
      if (parsed.success) {
        const report = { ...parsed.data, case_id: caseId };
        const output = {
          case_id: caseId,
          analysis: {
            provider: provider.name,
            model: args.model,
            prompt_version: VIAS_PROMPT_VERSION,
            generated_at: new Date().toISOString(),
            context_chars: rendered.length,
            similar_case_ids: context.similar.map((item) => item.id),
            law_ids: context.laws.map((law) => law.boe_id),
            tokens: result.tokens,
            cost: result.cost,
            validation: "OK",
            attempts,
          },
          report,
        };
        const outPath = path.join(caseDir(caseId), "structured", "vias.json");
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
        return `vias=${report.vias.length} similares=${context.similar.length} normas=${context.laws.length} intentos=${attempts}`;
      }
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      process.stdout.write(`  intento ${attempts}/${maxAttempts}: esquema incorrecto (${lastError})\n`);
    } catch (error) {
      lastError = String(error);
      process.stdout.write(`  intento ${attempts}/${maxAttempts}: JSON ilegible\n`);
    }
  }

  const failedPath = path.join(caseDir(caseId), "structured", "vias_failed.txt");
  await fs.mkdir(path.dirname(failedPath), { recursive: true });
  await fs.writeFile(failedPath, `--- error ---\n${lastError}\n\n--- respuesta ---\n${lastRaw}`, "utf8");
  throw new Error(`${caseId}: fallo tras ${attempts} intentos (${lastError})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.cases.length === 0) {
    process.stderr.write(
      "Uso: pnpm vias -- --cases=case_000034[,case_000039] [--model=X] [--retries=2] [--force]\n",
    );
    process.exitCode = 1;
    return;
  }

  const provider = new OpencodeCliProvider();
  process.stdout.write(`Proveedor: ${provider.name} | Modelo: ${args.model}\n\n`);
  let ok = 0;
  for (const caseId of args.cases) {
    const outPath = path.join(caseDir(caseId), "structured", "vias.json");
    const exists = await fs
      .stat(outPath)
      .then(() => true)
      .catch(() => false);
    if (exists && !args.force) {
      process.stdout.write(`${caseId}: ya tiene análisis de vías (--force para repetir)\n`);
      continue;
    }
    const started = Date.now();
    try {
      const message = await runVias(provider, caseId, args);
      ok += 1;
      process.stdout.write(`${caseId}: OK (${Math.round((Date.now() - started) / 1000)}s) ${message}\n`);
    } catch (error) {
      process.stderr.write(`${caseId}: ${String(error)}\n`);
      process.exitCode = 1;
    }
  }

  process.stdout.write(`\n== FASE 10: ANÁLISIS DE VÍAS ==\n`);
  process.stdout.write(`Generados: ${ok}/${args.cases.length}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
