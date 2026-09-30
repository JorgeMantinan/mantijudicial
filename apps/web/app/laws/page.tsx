import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { listLaws } from "@/lib/dataset";
import { SortTh } from "@/lib/sort-th";

export const dynamic = "force-dynamic";

const SORTS = ["titulo", "bloques", "chars", "fecha"] as const;
type SortKey = (typeof SORTS)[number];

export default async function LawsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  await requireActor();
  const params = await searchParams;
  const laws = await listLaws();

  const sort = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "titulo";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const sorted = [...laws].sort((a, b) => {
    let cmp = 0;
    if (sort === "titulo") cmp = a.titulo.localeCompare(b.titulo, "es");
    else if (sort === "bloques") cmp = a.blocks - b.blocks;
    else if (sort === "chars") cmp = a.chars - b.chars;
    else cmp = String(a.retrieved_at).localeCompare(String(b.retrieved_at));
    return dir === "asc" ? cmp : -cmp;
  });

  return (
    <>
      <h1>Legislación</h1>
      <p className="lead">
        Texto consolidado descargado de la API de datos abiertos del BOE ({laws.length} normas).
        Pulsa una cabecera para ordenar.
      </p>

      <div className="notice">
        Los textos consolidados tienen carácter <strong>meramente informativo</strong>. Para
        decisiones jurídicas debe consultarse la publicación oficial en boe.es.
      </div>

      <table>
        <thead>
          <tr>
            <SortTh path="/laws" sortKey="titulo" current={sort} dir={dir} label="Norma" />
            <SortTh path="/laws" sortKey="bloques" current={sort} dir={dir} label="Bloques" />
            <SortTh path="/laws" sortKey="chars" current={sort} dir={dir} label="Caracteres" />
            <SortTh path="/laws" sortKey="fecha" current={sort} dir={dir} label="Descargado" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((law) => (
            <tr key={law.boe_id}>
              <td>
                <Link href={`/laws/${law.boe_id}`}>{law.titulo}</Link>
                <div className="mono small muted">{law.boe_id}</div>
              </td>
              <td>{law.blocks}</td>
              <td>{law.chars.toLocaleString("es-ES")}</td>
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
