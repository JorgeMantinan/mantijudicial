import { buildIndex, search, type SearchDoc, type SearchHit } from "@pipeline/search";
import { caseNames, getCase, getLaw, listLaws, section } from "./dataset-base";

const INDEX_TTL_MS = 30_000;

let searchDocs: { docs: SearchDoc[]; index: ReturnType<typeof buildIndex>; at: number } | null = null;
let reconstruyendoIndice = false;

async function construirIndice(): Promise<void> {
  const [caseDocs, articleDocs] = await Promise.all([loadCaseDocs(), loadArticleDocs()]);
  const docs = [...caseDocs, ...articleDocs];
  searchDocs = { docs, index: buildIndex(docs), at: Date.now() };
}

/** Reconstruye en segundo plano: quien pide búsqueda mientras tanto se sirve
 * con el índice anterior en lugar de pagar ~3 s (2,5 s bloqueando el event
 * loop) dentro de su propia petición. */
function programarReconstruccion(): void {
  if (reconstruyendoIndice) return;
  reconstruyendoIndice = true;
  setTimeout(() => {
    construirIndice()
      .catch((error) => console.error("No se pudo reconstruir el índice:", error))
      .finally(() => {
        reconstruyendoIndice = false;
      });
  }, 0);
}

/** Precarga del índice al arrancar (instrumentation.ts) para que la primera
 * petición de búsqueda no pague la construcción. */
export function warmSearchIndex(): void {
  if (searchDocs || reconstruyendoIndice) return;
  programarReconstruccion();
}

async function getIndex(): Promise<{ docs: SearchDoc[]; index: ReturnType<typeof buildIndex> }> {
  if (searchDocs && Date.now() - searchDocs.at < INDEX_TTL_MS) {
    return { docs: searchDocs.docs, index: searchDocs.index };
  }
  if (searchDocs) {
    programarReconstruccion();
    return { docs: searchDocs.docs, index: searchDocs.index };
  }
  await construirIndice();
  return { docs: searchDocs!.docs, index: searchDocs!.index };
}

export async function runSearch(
  query: string,
  options: {
    kinds?: string[];
    limit?: number;
    filters?: Record<string, string>;
    allow?: (doc: SearchDoc) => boolean;
  } = {},
): Promise<{ hits: SearchHit[]; docs: number }> {
  const { docs, index } = await getIndex();
  const hits = search(index, query, {
    kinds: options.kinds,
    limit: options.limit ?? 15,
    filters: options.filters,
    allow: options.allow,
  });
  return { hits, docs: docs.length };
}

export interface SimilarCase {
  id: string;
  title: string;
  score: number;
  branch: string;
  outcome: string;
  why: string[];
}

/**
 * `permitido(caseId)` restringe los similares a los casos que el actor ve
 * (mismo patrón que getInforme/getTema): sin eso, la ficha pintaba ids y
 * títulos de casos de otros despachos.
 */
export async function getSimilarCases(
  caseId: string,
  limit = 5,
  permitido: (caseId: string) => boolean = () => true,
): Promise<SimilarCase[]> {
  const detail = await getCase(caseId);
  if (!detail) return [];

  const topics = detail.reasoning
    .flatMap((holding) => [holding.topic, holding.doctrine])
    .filter((value): value is string => Boolean(value && value !== "UNKNOWN"));
  const query = [detail.headline, detail.subtopic, ...topics].join(" ");

  const { index } = await getIndex();
  const hits = search(index, query, {
    kinds: ["case"],
    limit: limit + 6,
    allow: (doc) => permitido(doc.id),
  });
  const ownLaws = new Set(
    detail.lawRefs
      .map((ref) => ref.boe_id)
      .filter((value): value is string => Boolean(value)),
  );
  const ownTerms = new Set(
    topics.map((value) => value.toLowerCase()).concat(detail.branch.toLowerCase()),
  );

  const results: SimilarCase[] = [];
  for (const hit of hits) {
    if (hit.id === caseId) continue;
    const sharedTerms = hit.matchedTerms.filter((term) => ownTerms.has(term));
    const sharedLaws = ((hit.meta as { laws?: string }).laws ?? "")
      .split(",")
      .filter((value) => value && ownLaws.has(value));
    const why: string[] = [];
    if (sharedTerms.length > 0) why.push(`temas compartidos: ${sharedTerms.join(", ")}`);
    if (hit.phraseMatch) why.push("coincidencia de frase literal");
    if (sharedLaws.length > 0) why.push(`mismas normas: ${sharedLaws.join(", ")}`);
    if (sharedTerms.length === 0 && !hit.phraseMatch && sharedLaws.length === 0) {
      why.push(`términos coincidentes: ${hit.matchedTerms.slice(0, 6).join(", ")}`);
    }
    results.push({
      id: hit.id,
      title: hit.title,
      score: hit.score,
      branch: String(hit.meta.branch ?? ""),
      outcome: String(hit.meta.outcome ?? ""),
      why,
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function loadCaseDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const names = await caseNames();
  for (const name of names) {
    const review = await section<{ extraction?: { validation?: string } }>(name, "review.json");
    if (review?.extraction?.validation !== "OK") continue;
    const summary = await section<{
      summary?: { headline?: string; summary?: string; key_points?: string[] };
    }>(name, "summary.json");
    const classification = await section<{
      classification?: { civil_branch?: string; subtopic?: string };
    }>(name, "classification.json");
    const outcome = await section<{
      outcome?: { cassation_outcome?: string; recurring_side?: string; reasoning_summary?: string };
    }>(name, "outcome.json");
    const issues = await section<{ issues?: Array<{ topic?: string; description?: string }> }>(name, "issues.json");
    const facts = await section<{ facts?: Array<{ description?: string }> }>(name, "facts.json");
    const argumentsFile = await section<{
      arguments?: Array<{ description?: string; legal_basis?: string }>;
    }>(name, "arguments.json");
    const reasoning = await section<{
      holdings?: Array<{
        holding_id?: string;
        statement?: string;
        topic?: string;
        doctrine?: string;
        importance?: number;
      }>;
    }>(name, "reasoning.json");
    const citedLaws = await section<{
      citations?: Array<{ raw_text?: string; norma?: string; article?: string }>;
    }>(name, "cited_laws.json");
    const parties = await section<{ parties?: Array<{ name?: string }> }>(name, "parties.json");
    const lawRefs = await section<{ refs?: Array<{ boe_id?: string | null }> }>(name, "law_refs.json");
    const lawIds = (lawRefs?.refs ?? [])
      .map((ref) => ref.boe_id)
      .filter((value): value is string => Boolean(value))
      .join(",");

    const meta = {
      branch: classification?.classification?.civil_branch ?? "UNKNOWN",
      outcome: outcome?.outcome?.cassation_outcome ?? "UNKNOWN",
      case: name,
      laws: lawIds,
    };
    const parts = [
      summary?.summary?.summary,
      ...(summary?.summary?.key_points ?? []),
      outcome?.outcome?.reasoning_summary,
      ...(issues?.issues ?? []).flatMap((issue) => [issue.topic, issue.description]),
      ...(facts?.facts ?? []).map((fact) => fact.description),
      ...(argumentsFile?.arguments ?? []).flatMap((argument) => [argument.description, argument.legal_basis]),
      ...(citedLaws?.citations ?? []).flatMap((citation) => [citation.raw_text, citation.norma]),
      ...(parties?.parties ?? []).map((party) => party.name),
    ].filter((value): value is string => Boolean(value && value.trim()));

    docs.push({
      id: name,
      kind: "case",
      title: summary?.summary?.headline ?? classification?.classification?.subtopic ?? name,
      body: parts.join("\n"),
      meta,
    });

    for (const holding of reasoning?.holdings ?? []) {
      if (!holding.statement) continue;
      docs.push({
        id: `${name}#${holding.holding_id ?? "HOLD"}`,
        kind: "holding",
        title: holding.topic ?? holding.statement.slice(0, 80),
        body: `${holding.statement}\n${holding.doctrine ?? ""}`,
        meta: { ...meta, importance: String(holding.importance ?? 3) },
      });
    }
  }
  return docs;
}

async function loadArticleDocs(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];
  const norms = await listLaws();
  for (const entry of norms) {
    const norm = await getLaw(entry.boe_id);
    if (!norm) continue;
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
