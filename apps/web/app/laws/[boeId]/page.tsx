import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { getLaw, type LawBlock } from "@/lib/dataset";
import { BLOCK_TIPO, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

function blockMatches(block: LawBlock, needle: string): boolean {
  const clean = needle.trim().toLowerCase();
  if (!clean) return false;
  return block.id.toLowerCase() === clean || block.titulo.toLowerCase().includes(clean);
}

/** Nivel jerárquico de un encabezado a partir de su identificador del BOE. */
function headingLevel(block: LawBlock): number | null {
  if (!/encabezado/i.test(block.tipo)) return null;
  const id = block.id.toLowerCase();
  if (/^(ad|dd|df|disp|fd)/.test(id)) return 1;
  if (/^l[a-z]+$/.test(id)) return 1;
  if (id.startsWith("t")) return 2;
  if (id.startsWith("c")) return 3;
  if (id.startsWith("s")) return 4;
  return 5;
}

type Row = LawBlock & { path: string[] };

function withPaths(blocks: LawBlock[]): Row[] {
  const stack: Array<{ level: number; titulo: string }> = [];
  return blocks.map((block) => {
    const level = headingLevel(block);
    if (level !== null) {
      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();
      stack.push({ level, titulo: block.titulo || block.id });
    }
    return { ...block, path: stack.map((item) => item.titulo) };
  });
}

function fechaEs(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd || "—";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

export default async function LawDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ boeId: string }>;
  searchParams: Promise<{ block?: string; q?: string; version?: string }>;
}) {
  const { boeId } = await params;
  await requireActor();
  const sp = await searchParams;
  const norm = await getLaw(boeId);
  if (!norm) notFound();

  const selected = sp.block
    ? norm.blocks.find((block) => block.id === sp.block || blockMatches(block, sp.block!))
    : null;

  const olderVersions =
    selected?.versions?.filter((version) => version.fecha_vigencia !== selected.fecha_vigencia) ??
    [];
  const chosenVersion =
    selected && sp.version && sp.version !== "actual"
      ? (selected.versions ?? []).find((version) => version.fecha_vigencia === sp.version)
      : null;

  const toc = sp.q
    ? norm.blocks.filter((block) => blockMatches(block, sp.q ?? ""))
    : norm.blocks.filter((block) => block.tipo !== "precepto" || block.titulo.startsWith("Art 1"));
  const rows = withPaths(toc);

  return (
    <>
      <p className="small muted">
        <Link href="/laws">← Volver a legislación</Link>
      </p>
      <h1 style={{ marginTop: 4 }}>{norm.titulo}</h1>
      <p className="lead">
        <span className="mono">{norm.boe_id}</span> · {norm.rango} · {norm.ambito} ·{" "}
        <a href={norm.url_html} target="_blank" rel="noreferrer">
          texto oficial en el BOE
        </a>
      </p>

      <div className="notice">{norm.notice}</div>

      {selected ? (
        <div className="section" id={selected.id}>
          <h2>
            {selected.titulo || selected.id}{" "}
            <span className="muted small">({label(BLOCK_TIPO, selected.tipo)})</span>
          </h2>
          <p className="small muted mono">
            {selected.id} ·{" "}
            {chosenVersion
              ? `versión anterior con vigencia desde ${fechaEs(chosenVersion.fecha_vigencia)}`
              : `vigente desde ${fechaEs(selected.fecha_vigencia)}`}
          </p>

          {olderVersions.length > 0 && (
            <form className="filters" action={`/laws/${norm.boe_id}`} method="get">
              <input type="hidden" name="block" value={selected.id} />
              <label className="small muted" style={{ display: "grid", gap: 4 }}>
                Versión del texto
                <select name="version" defaultValue={sp.version ?? "actual"}>
                  <option value="actual">
                    Vigente (desde {fechaEs(selected.fecha_vigencia)})
                  </option>
                  {olderVersions.map((version) => (
                    <option key={version.fecha_vigencia} value={version.fecha_vigencia}>
                      Anterior — desde {fechaEs(version.fecha_vigencia)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Ver versión</button>
            </form>
          )}

          <p className="small">
            <Link href={`/laws/${norm.boe_id}`}>← índice completo</Link>
          </p>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {(chosenVersion ?? selected).texto}
          </div>
        </div>
      ) : (
        <>
          <form className="filters" action={`/laws/${norm.boe_id}`} method="get">
            <input name="q" defaultValue={sp.q ?? ""} placeholder="Filtrar bloques (p. ej. Art 1124)" />
            <button type="submit">Filtrar</button>
            {sp.q && (
              <Link className="small" href={`/laws/${norm.boe_id}`}>
                limpiar
              </Link>
            )}
          </form>

          <p className="small muted">
            {rows.length} bloques del índice de estructura. Cada fila indica su jerarquía (libro,
            título, capítulo…); el texto mostrado es la versión <strong>vigente</strong>.
          </p>

          <table>
            <thead>
              <tr>
                <th>Bloque</th>
                <th>Tipo</th>
                <th>Vigencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((block) => (
                <tr key={block.id}>
                  <td>
                    <Link href={`/laws/${norm.boe_id}?block=${encodeURIComponent(block.id)}`}>
                      {block.titulo || block.id}
                    </Link>
                    {block.path.length > 1 && (
                      <div className="small muted">{block.path.slice(0, -1).join(" › ")}</div>
                    )}
                  </td>
                  <td className="small">{label(BLOCK_TIPO, block.tipo)}</td>
                  <td className="mono small">{fechaEs(block.fecha_vigencia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
