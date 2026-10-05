import Link from "next/link";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getBusquedas, getEvolucion, listCases, runSearch } from "@/lib/dataset";
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
  let totalResultados = 0;
  let masPaginas = false;
  let recientes = new Set<string>();
  const exactos = query.length >= 4 ? await findByIdentifier(query) : [];
  const busquedas = await getBusquedas(actor.orgId);
  if (query.length > 0) {
    const filters: Record<string, string> = {};
    if (params.branch) filters.branch = params.branch;
    if (params.outcome) filters.outcome = params.outcome;
    const result = await runSearch(query, {
      kinds: params.kind ? [params.kind] : undefined,
      limit: 10_000,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      allow: (doc) => doc.kind === "article" || canSee(doc.id),
    });
    hits = result.hits.slice(offset, offset + porPagina);
    totalResultados = result.hits.length;
    docs = result.docs;
    masPaginas = totalResultados > offset + porPagina;
    const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    recientes = new Set(
      (await listCases())
        .filter((item) => (item.generatedAt ?? "").slice(0, 10) >= hace30)
        .map((item) => item.id),
    );
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

  // Se calcula DESPUÉS de poblar `hits` (antes salía siempre "sin resultados").
  const sinResultados = query.length > 0 && hits.length === 0 && exactos.length === 0;
  let sugerencias: Array<{ topic: string; casos: number }> = [];
  if (query.length >= 4) {
    const palabras = query
      .toLowerCase()
      .split(/\s+/)
      .filter((palabra) => palabra.length >= 4);
    const puntuados = (await getEvolucion())
      .map((tema) => ({
        topic: tema.topic,
        casos: tema.cases,
        score:
          palabras.filter((palabra) => tema.topic.toLowerCase().includes(palabra)).length * 10 +
          Math.min(tema.cases / 100, 0.9),
      }))
      .sort((a, b) => b.score - a.score);
    const afines = puntuados.filter((tema) => tema.score >= 1).slice(0, 5);
    sugerencias = (afines.length > 0 ? afines : puntuados.slice(0, 5)).map(({ topic, casos }) => ({
      topic,
      casos,
    }));
  }

  return (
    <>
      <h1>Búsqueda</h1>
      <p className="lead">
        Índice híbrido BM25 sobre casos, frases del tribunal y artículos del BOE, con bonus por
        frase exacta y filtros por rama/resultado.
      </p>

      <form className="filters" action="/search" method="get">
        <input
          name="q"
          defaultValue={query}
          autoFocus={query.length === 0}
          placeholder="Texto, ECLI, ROJ (STS 3706/2026) o nº de recurso"
        />
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
          Página {pagina} · {offset + 1}–{offset + hits.length} de {totalResultados} resultados ·{" "}
          {docs} documentos indexados.
        </p>
      )}

      {sinResultados && (
        <div className="section">
          <h2>Sin resultados para «{query}»</h2>
          <p className="small muted">
            Prueba con menos palabras, sin acentos, o con un identificador (ECLI, ROJ o nº de
            recurso).
          </p>
          {sugerencias.length > 0 && (
            <>
              <p className="small">Temas del corpus que podrían encajar:</p>
              <ul className="small">
                {sugerencias.map((sugerencia) => (
                  <li key={sugerencia.topic}>
                    <Link href={`/temas/${encodeURIComponent(sugerencia.topic)}`}>
                      {sugerencia.topic}
                    </Link>{" "}
                    · {sugerencia.casos} casos
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="small">
            <Link href={`/laws?q=${encodeURIComponent(query)}`}>
              Buscar también en el texto de las leyes →
            </Link>
          </p>
        </div>
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
              {hit.kind !== "article" && recientes.has(hit.id.split("#")[0]) && (
                <span className="badge ok" style={{ marginLeft: 6 }}>
                  nuevo
                </span>
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

      {query.length > 0 && hits.length > 0 && sugerencias.length > 0 && (
        <p className="small no-print" style={{ marginTop: 10 }}>
          También podrías mirar:{" "}
          {sugerencias.slice(0, 3).map((sugerencia, index) => (
            <span key={sugerencia.topic}>
              {index > 0 && " · "}
              <Link href={`/temas/${encodeURIComponent(sugerencia.topic)}`}>{sugerencia.topic}</Link>
            </span>
          ))}
        </p>
      )}

      {query.length > 0 && (pagina > 1 || masPaginas) && (
        <p className="small no-print" style={{ display: "flex", gap: 14 }}>
          {pagina > 1 && <Link href={hrefPagina(pagina - 1)}>← Página anterior</Link>}
          {masPaginas && <Link href={hrefPagina(pagina + 1)}>Página siguiente →</Link>}
        </p>
      )}
    </>
  );
}
