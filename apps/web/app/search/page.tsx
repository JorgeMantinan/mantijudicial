import Link from "next/link";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { runSearch } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const dynamic = "force-dynamic";

const KINDS = [
  { value: "", label: "Todo" },
  { value: "case", label: "Casos" },
  { value: "holding", label: "Frases del tribunal" },
  { value: "article", label: "Artículos legales" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; branch?: string; outcome?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const canSee = (id: string) =>
    canViewCase(actor, id.split("#")[0] ?? id, orgId, grants);

  let hits: Awaited<ReturnType<typeof runSearch>>["hits"] = [];
  let docs = 0;
  if (query.length > 0) {
    const filters: Record<string, string> = {};
    if (params.branch) filters.branch = params.branch;
    if (params.outcome) filters.outcome = params.outcome;
    const result = await runSearch(query, {
      kinds: params.kind ? [params.kind] : undefined,
      limit: 25,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      allow: (doc) => doc.kind === "article" || canSee(doc.id),
    });
    hits = result.hits;
    docs = result.docs;
  }

  return (
    <>
      <h1>Búsqueda</h1>
      <p className="lead">
        Índice híbrido BM25 sobre casos, frases del tribunal y artículos del BOE, con bonus por
        frase exacta y filtros por rama/resultado.
      </p>

      <form className="filters" action="/search" method="get">
        <input name="q" defaultValue={query} placeholder="p. ej. cláusula suelo nulidad restitución" />
        <select name="kind" defaultValue={params.kind ?? ""}>
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
        <select name="branch" defaultValue={params.branch ?? ""}>
          <option value="">Todas las ramas</option>
          <option value="CONTRACTUAL">CONTRACTUAL</option>
          <option value="CONSUMER_ABUSIVE_CLAUSES">CONSUMER_ABUSIVE_CLAUSES</option>
          <option value="COMMERCIAL">COMMERCIAL</option>
          <option value="CIVIL_LIABILITY">CIVIL_LIABILITY</option>
          <option value="LEASE_PROPERTY">LEASE_PROPERTY</option>
          <option value="PROPERTY_COMMUNITY">PROPERTY_COMMUNITY</option>
        </select>
        <select name="outcome" defaultValue={params.outcome ?? ""}>
          <option value="">Cualquier resultado</option>
          <option value="ESTIMED">ESTIMED</option>
          <option value="DISMISSED">DISMISSED</option>
          <option value="PARTIALLY_ESTIMATED">PARTIALLY_ESTIMATED</option>
        </select>
        <button type="submit">Buscar</button>
      </form>

      {query.length === 0 && <p className="muted">Escribe una consulta para buscar.</p>}

      {query.length > 0 && (
        <p className="small muted">
          {hits.length} resultados de {docs} documentos indexados.
        </p>
      )}

      <ol className="results">
        {hits.map((hit) => (
          <li key={hit.id}>
            <div className="title">
              {hit.kind === "article" ? (
                <Link href={`/laws/${hit.meta.boe_id}?block=${encodeURIComponent(hit.id.split("#")[1] ?? "")}`}>
                  {hit.title}
                </Link>
              ) : (
                <Link href={`/cases/${hit.id.split("#")[0]}`}>{hit.title}</Link>
              )}
            </div>
            <div className="small muted">
              <span className="badge">{hit.kind}</span> {hit.id} · score {hit.score}
              {hit.phraseMatch ? " · frase exacta" : ""}
              {hit.meta.branch ? ` · ${hit.meta.branch}` : ""}
              {hit.meta.outcome ? ` · ${hit.meta.outcome}` : ""}
            </div>
            <div className="small">«{hit.snippet}»</div>
            <div className="small muted">términos: {hit.matchedTerms.join(", ")}</div>
          </li>
        ))}
      </ol>
    </>
  );
}
