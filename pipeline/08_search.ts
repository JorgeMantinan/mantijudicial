import fs from "node:fs/promises";
import path from "node:path";
import { buildIndex, search, type SearchDoc } from "./lib/search.js";
import { CASES_DIR, LAWS_DIR } from "./lib/paths.js";

interface Args {
  query: string[];
  kinds: string[] | null;
  limit: number;
  filters: Record<string, string>;
}

function parseArgs(argv: string[]): Args {
  const query: string[] = [];
  const args: Args = { query, kinds: null, limit: 10, filters: {} };
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      args.query.push(arg);
      continue;
    }
    const [rawKey, rawValue] = arg.slice(2).split("=");
    if (!rawKey || rawValue === undefined) continue;
    if (rawKey === "kind") args.kinds = rawValue.split(",").map((value) => value.trim());
    else if (rawKey === "limit") args.limit = Number(rawValue);
    else args.filters[rawKey] = rawValue;
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

function joinParts(parts: Array<string | undefined | null>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
}

async function loadCaseDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const names = (await fs.readdir(CASES_DIR)).filter((name) => name.startsWith("case_")).sort();

  for (const name of names) {
    const dir = path.join(CASES_DIR, name, "structured");
    const review = await readJson<{ extraction?: { validation?: string } }>(path.join(dir, "review.json"));
    if (review?.extraction?.validation !== "OK") continue;

    const summary = await readJson<{
      summary?: { headline?: string; summary?: string; key_points?: string[] };
    }>(path.join(dir, "summary.json"));
    const classification = await readJson<{
      classification?: { civil_branch?: string; subtopic?: string; finality_status?: string };
    }>(path.join(dir, "classification.json"));
    const outcome = await readJson<{
      outcome?: { cassation_outcome?: string; recurring_side?: string; reasoning_summary?: string };
    }>(path.join(dir, "outcome.json"));
    const facts = await readJson<{ facts?: Array<{ description?: string }> }>(path.join(dir, "facts.json"));
    const argumentsFile = await readJson<{
      arguments?: Array<{ description?: string; legal_basis?: string }>;
    }>(path.join(dir, "arguments.json"));
    const issues = await readJson<{ issues?: Array<{ topic?: string; description?: string }> }>(
      path.join(dir, "issues.json"),
    );
    const reasoning = await readJson<{
      holdings?: Array<{ holding_id?: string; statement?: string; topic?: string; doctrine?: string; importance?: number; is_literal_quote?: boolean }>;
    }>(path.join(dir, "reasoning.json"));
    const citedLaws = await readJson<{ citations?: Array<{ raw_text?: string; norma?: string; article?: string }> }>(
      path.join(dir, "cited_laws.json"),
    );
    const parties = await readJson<{ parties?: Array<{ name?: string; side?: string }> }>(
      path.join(dir, "parties.json"),
    );

    const branch = classification?.classification?.civil_branch ?? "UNKNOWN";
    const caseOutcome = outcome?.outcome?.cassation_outcome ?? "UNKNOWN";
    const meta = {
      branch,
      outcome: caseOutcome,
      recurring_side: outcome?.outcome?.recurring_side ?? "UNKNOWN",
      case: name,
    };

    docs.push({
      id: name,
      kind: "case",
      title: joinParts([summary?.summary?.headline, classification?.classification?.subtopic]) || name,
      body: joinParts([
        summary?.summary?.summary,
        ...(summary?.summary?.key_points ?? []),
        outcome?.outcome?.reasoning_summary,
        ...(issues?.issues ?? []).flatMap((issue) => [issue.topic, issue.description]),
        ...(facts?.facts ?? []).map((fact) => fact.description),
        ...(argumentsFile?.arguments ?? []).flatMap((argument) => [
          argument.description,
          argument.legal_basis,
        ]),
        ...(citedLaws?.citations ?? []).flatMap((citation) => [
          citation.raw_text,
          citation.norma && citation.article ? `${citation.article} ${citation.norma}` : citation.norma,
        ]),
        ...(parties?.parties ?? []).map((party) => party.name),
      ]),
      meta,
    });

    for (const holding of reasoning?.holdings ?? []) {
      if (!holding.statement) continue;
      docs.push({
        id: `${name}#${holding.holding_id ?? "HOLD"}`,
        kind: "holding",
        title: joinParts([holding.topic, holding.doctrine]) || holding.statement.slice(0, 80),
        body: joinParts([holding.statement, holding.doctrine]),
        meta: { ...meta, importance: String(holding.importance ?? 3) },
      });
    }
  }
  return docs;
}

async function loadArticleDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const dir = path.join(LAWS_DIR, "norms");
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return docs;
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const norm = await readJson<{
      boe_id: string;
      titulo: string;
      blocks: Array<{ id: string; tipo: string; titulo: string; texto: string }>;
    }>(path.join(dir, name));
    if (!norm?.blocks) continue;
    for (const block of norm.blocks) {
      if (!block.texto) continue;
      docs.push({
        id: `${norm.boe_id}#${block.id}`,
        kind: "article",
        title: `${block.titulo || block.id} · ${norm.boe_id}`,
        body: `${norm.titulo}\n${block.texto}`,
        meta: { boe_id: norm.boe_id, tipo: block.tipo, titulo: block.titulo },
      });
    }
  }
  return docs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const query = args.query.join(" ").trim();
  if (query.length === 0) {
    process.stderr.write(
      'Uso: pnpm search -- "consulta" [--kind=case,article,holding] [--branch=CONTRACTUAL] [--outcome=ESTIMED] [--boe=BOE-A-...] [--limit=10]\n',
    );
    process.exitCode = 1;
    return;
  }

  const started = Date.now();
  const [caseDocs, articleDocs] = await Promise.all([loadCaseDocs(), loadArticleDocs()]);
  const docs = [...caseDocs, ...articleDocs];
  const index = buildIndex(docs);
  const hits = search(index, query, {
    kinds: args.kinds ?? undefined,
    limit: args.limit,
    filters: Object.keys(args.filters).length > 0 ? args.filters : undefined,
  });

  process.stdout.write(
    `Índice: ${caseDocs.filter((doc) => doc.kind === "case").length} casos, ` +
      `${caseDocs.filter((doc) => doc.kind === "holding").length} frases, ` +
      `${articleDocs.length} bloques normativos (${Date.now() - started} ms)\n`,
  );
  process.stdout.write(`Consulta: ${query}\n\n`);

  if (hits.length === 0) {
    process.stdout.write("Sin resultados.\n");
    return;
  }

  hits.forEach((hit, position) => {
    const filters = Object.entries(hit.meta)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    process.stdout.write(
      `${String(position + 1).padStart(2)}. [${hit.kind}] ${hit.id}  score=${hit.score}${
        hit.phraseMatch ? "  (frase exacta)" : ""
      }\n    ${hit.title}\n    ${filters}\n    «${hit.snippet}»\n\n`,
    );
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
