import Link from "next/link";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getBusquedas, runSearch } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { findByIdentifier } from "@/lib/identifier";
import { BRANCH, OUTCOME, SEARCH_KIND, label } from "@/lib/labels";
import { BusquedasGuardadas } from "./busquedas-guardadas";

export const dynamic = "force-dynamic";

function escapeRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Resalta los términos buscados dentro del fragmento de resultado. */
function resaltar(texto: string, terminos: string[]): React.ReactNode {
  const utiles = terminos.filter((termino) => termino.length >= 3);
  if (utiles.length === 0) return texto;
  const patron = new RegExp(`(${utiles.map(escapeRegExp).join("|")})`, "gi");
  return texto
    .split(patron)
    .map((pedazo, index) =>
      utiles.some((termino) => termino.toLowerCase() === pedazo.toLowerCase()) ? (
        <mark key={index}>{pedazo}</mark>
      ) : (
        pedazo
      ),
    );
}

const KINDS = [
  { value: "", label: "Todo" },
  { value: "case", label: "Casos" },
  { value: "holding", label: "Frases del tribunal" },
  { value: "article", label: "Artículos legales" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; branch?: string; outcome?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const pagina = Math.max(1, Number(params.page) || 1);
  const porPagina = 25;
  const offset = (pagina - 1) * porPagina;
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const canSee = (id: string) =>
    canViewCase(actor, id.split("#")[0] ?? id, orgId, grants);

  let hits: Awaited<ReturnType<typeof runSearch>>["hits"] = [];
  let docs = 0;
  let masPaginas = false;
  const exactos = query.length >= 4 ? await findByIdentifier(query) : [];
  const busquedas = await getBusquedas();
  if (query.length > 0) {
    const filters: Record<string, string> = {};
    if (params.branch) filters.branch = params.branch;
    if (params.outcome) filters.outcome = params.outcome;
    const result = await runSearch(query, {
      kinds: params.kind ? [params.kind] : undefined,
      limit: Math.min(offset + porPagina, 100),
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      allow: (doc) => doc.kind === "article" || canSee(doc.id),
    });
    const ventana = result.hits.slice(offset, offset + porPagina);
    hits = ventana;
    docs = result.docs;
    masPaginas = result.hits.length > offset + porPagina;
  }

  const hrefPagina = (n: number): string => {
    const p = new URLSearchParams();
    p.set("q", query);
    if (params.kind) p.set("kind", params.kind);
    if (params.branch) p.set("branch", params.branch);
    if (params.outcome) p.set("outcome", params.outcome);
    if (n > 1) p.set("page", String(n));
    return `/search?${p.toString()}`;
  };

  return (
    <>
      <h1>Búsqueda</h1>
      <p className="lead">
        Índice híbrido BM25 sobre casos, frases del tribunal y artículos del BOE, con bonus por
        frase exacta y filtros por rama/resultado.
      </p>

      <form className="filters" action="/search" method="get">
        <input name="q" defaultValue={query} placeholder="Texto, ECLI, ROJ (STS 3706/2026) o nº de recurso" />
        <select name="kind" defaultValue={params.kind ?? ""}>
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
        <select name="branch" defaultValue={params.branch ?? ""}>
          <option value="">Todas las ramas</option>
          {Object.entries(BRANCH).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={params.outcome ?? ""}>
          <option value="">Cualquier resultado</option>
          {Object.entries(OUTCOME).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <button type="submit">Buscar</button>
      </form>

      <BusquedasGuardadas
        items={busquedas}
        q={query}
        kind={params.kind ?? ""}
        branch={params.branch ?? ""}
        outcome={params.outcome ?? ""}
      />

      {query.length === 0 && <p className="muted">Escribe una consulta para buscar.</p>}

      {query.length > 0 && (
        <p className="small muted">
          Página {pagina} · mostrando {offset + 1}–{offset + hits.length} de {docs} documentos
          indexados.
        </p>
      )}

      {exactos.length > 0 && (
        <div className="section">
          <h2>Coincidencia exacta por identificador</h2>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Caso</th>
              </tr>
            </thead>
            <tbody>
              {exactos
                .filter((item) => canViewCase(actor, item.caseId, orgId, grants))
                .map((item) => (
                  <tr key={`${item.caseId}-${item.field}`}>
                    <td className="small">{item.field}</td>
                    <td className="mono small">{item.value}</td>
                    <td className="small">
                      <Link href={`/cases/${item.caseId}`}>
                        {item.headline || item.caseId}
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
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
              <span className="badge">{label(SEARCH_KIND, hit.kind)}</span> {hit.id} · score{" "}
              {hit.score}
              {hit.phraseMatch ? " · frase exacta" : ""}
              {hit.meta.branch ? ` · ${label(BRANCH, hit.meta.branch)}` : ""}
              {hit.meta.outcome ? ` · ${label(OUTCOME, hit.meta.outcome)}` : ""}
            </div>
            <div className="small">«{resaltar(hit.snippet, hit.matchedTerms)}»</div>
            <div className="small muted">términos: {hit.matchedTerms.join(", ")}</div>
          </li>
        ))}
      </ol>

      {query.length > 0 && (pagina > 1 || masPaginas) && (
        <p className="small no-print" style={{ display: "flex", gap: 14 }}>
          {pagina > 1 && <Link href={hrefPagina(pagina - 1)}>← Página anterior</Link>}
          {masPaginas && <Link href={hrefPagina(pagina + 1)}>Página siguiente →</Link>}
        </p>
      )}
    </>
  );
}
