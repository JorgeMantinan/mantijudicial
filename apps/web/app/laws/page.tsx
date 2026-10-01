import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { listLaws, runSearch } from "@/lib/dataset";
import { SortTh } from "@/lib/sort-th";

export const dynamic = "force-dynamic";

const SORTS = ["boe", "bloques", "fecha"] as const;
type SortKey = (typeof SORTS)[number];

export default async function LawsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; q?: string }>;
}) {
  await requireActor();
  const params = await searchParams;
  const laws = await listLaws();
  const q = (params.q ?? "").trim();

  const sort = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "boe";
  const dir = params.dir === "desc" ? "desc" : "asc";
  /** Clave numérica: año (4 dígitos) + número de documento (hasta 1e6). */
  const claveBoe = (id: string): number => {
    const match = /(\d{4})-(\d+)/.exec(id);
    return match ? Number(match[1]) * 1_000_000 + Number(match[2]) : 0;
  };
  const sorted = [...laws].sort((a, b) => {
    let cmp = 0;
    if (sort === "boe") cmp = claveBoe(a.boe_id) - claveBoe(b.boe_id);
    else if (sort === "bloques") cmp = a.blocks - b.blocks;
    else cmp = String(a.retrieved_at).localeCompare(String(b.retrieved_at));
    return dir === "asc" ? cmp : -cmp;
  });

  const [hits, filtradas] = await Promise.all([
    q
      ? runSearch(q, { kinds: ["article"], limit: 25 }).then((result) => result.hits)
      : Promise.resolve([]),
    Promise.resolve(
      q
        ? sorted.filter((law) =>
            `${law.titulo} ${law.boe_id}`.toLowerCase().includes(q.toLowerCase()),
          )
        : sorted,
    ),
  ]);

  return (
    <>
      <h1>Legislación</h1>
      <p className="lead">
        Texto consolidado descargado de la API de datos abiertos del BOE ({laws.length} normas).
        Pulsa una cabecera para ordenar: «Norma (BOE)» ordena por año y número del BOE (p. ej.
        BOE-A-1882-6036 → BOE-A-2012-9058).
      </p>

      <form className="filters" action="/laws" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar un artículo o expresión (p. ej. casación, costas)"
        />
        {params.sort && <input type="hidden" name="sort" value={params.sort} />}
        <button type="submit">Buscar</button>
        {q && (
          <Link href="/laws" className="small">
            limpiar
          </Link>
        )}
      </form>

      {q && (
        <div className="section">
          <h2>Artículos que coinciden con «{q}»</h2>
          {hits.length === 0 ? (
            <p className="small muted">Sin coincidencias en el texto de los artículos.</p>
          ) : (
            <ul className="small">
              {hits.map((hit) => {
                const [boe, block] = hit.id.split("#");
                return (
                  <li key={hit.id}>
                    <Link href={`/laws/${boe}#${block}`}>{hit.title}</Link>
                    <div className="muted">{hit.snippet.slice(0, 180)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="notice">
        Los textos consolidados tienen carácter <strong>meramente informativo</strong>. Para
        decisiones jurídicas debe consultarse la publicación oficial en boe.es.
      </div>

      <table>
        <thead>
          <tr>
            <SortTh path="/laws" sortKey="boe" current={sort} dir={dir} label="Norma (BOE)" />
            <SortTh path="/laws" sortKey="bloques" current={sort} dir={dir} label="Bloques" />
            <SortTh path="/laws" sortKey="fecha" current={sort} dir={dir} label="Descargado" />
          </tr>
        </thead>
        <tbody>
          {filtradas.map((law) => (
            <tr key={law.boe_id}>
              <td>
                <Link href={`/laws/${law.boe_id}`}>{law.titulo}</Link>
                <div className="mono small muted">{law.boe_id}</div>
              </td>
              <td>{law.blocks}</td>
              <td className="small">{law.retrieved_at.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="small muted">
        Tipos de bloque: <strong>artículo</strong>, <strong>encabezado</strong> (libros, títulos,
        capítulos), disposiciones y preámbulos. Busca dentro de ellas en{" "}
        <Link href="/search?kind=article">búsqueda</Link>.
      </p>
    </>
  );
}
