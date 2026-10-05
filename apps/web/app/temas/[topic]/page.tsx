import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { CopyButton } from "@/components/copy-button";
import { canViewCase, requireActor , contextoVisibilidad } from "@/lib/auth";
import { filtrarFrasesDelTema, getGruposFrases, getTema } from "@/lib/dataset";
import { ARG_OUTCOME, ARG_TYPE, BRANCH, OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TemaPage({
  params,
  searchParams,
}: {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ sort?: string; dir?: string; branch?: string; outcome?: string }>;
}) {
  const { topic } = await params;
  const sp = await searchParams;
  const { actor, orgId, grants } = await contextoVisibilidad();
  const ficha = await getTema(topic, (caseId) => canViewCase(actor, caseId, orgId, grants), {
    branch: sp.branch,
    outcome: sp.outcome,
  });
  if (!ficha) {
    if (sp.branch || sp.outcome) {
      return (
        <>
          <p className="small muted">
            <Link href={`/temas/${encodeURIComponent(topic)}`}>← Sin filtros</Link>
          </p>
          <h1>Tema: {topic}</h1>
          <p className="muted">
            Ningún caso de este tema coincide con ese filtro de rama o resultado.
          </p>
        </>
      );
    }
    redirect("/evolucion");
  }

  const sort = ["fecha", "caso", "resultado"].includes(sp.sort ?? "") ? (sp.sort as string) : "fecha";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const entradas = [...ficha.tema.entries].sort((a, b) => {
    let cmp = 0;
    if (sort === "caso") cmp = a.caseId.localeCompare(b.caseId);
    else if (sort === "resultado") cmp = a.outcome.localeCompare(b.outcome);
    else cmp = a.fecha.localeCompare(b.fecha);
    return dir === "asc" ? cmp : -cmp;
  });
  const { tema, argumentos, leyes } = ficha;
  const conOrden = (campo: string): string => {
    const p = new URLSearchParams();
    p.set("sort", campo);
    p.set("dir", dir === "asc" && sort === campo ? "desc" : "asc");
    if (sp.branch) p.set("branch", sp.branch);
    if (sp.outcome) p.set("outcome", sp.outcome);
    return `/temas/${encodeURIComponent(tema.topic)}?${p.toString()}`;
  };
  const frasesTema = filtrarFrasesDelTema(
    await getGruposFrases(),
    new Set(entradas.map((entrada) => entrada.caseId)),
  );
  const resumenTema = [
    `Tema: ${tema.topic}`,
    `${tema.cases} casos (${tema.first.slice(0, 10)} → ${tema.last.slice(0, 10)})`,
    Object.entries(tema.distribution)
      .map(([outcome, cantidad]) => `${label(OUTCOME, outcome)}: ${cantidad}`)
      .join(" · "),
  ].join("\n");

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/evolucion">← Evolución</Link> · <Link href="/patterns">Patrones</Link> ·{" "}
        <Link href="/alertas">Alertas</Link> ·{" "}
        <Link href={`/temas/comparar?a=${encodeURIComponent(tema.topic)}`}>comparar con otro tema</Link> ·{" "}
        <a
          href={`/api/export/tema?tema=${encodeURIComponent(tema.topic)}${
            sp.branch ? `&branch=${encodeURIComponent(sp.branch)}` : ""
          }${sp.outcome ? `&outcome=${encodeURIComponent(sp.outcome)}` : ""}`}
        >
          descargar CSV
        </a>{" "}
        · <CopyButton texto={resumenTema} etiqueta="Copiar resumen" />
      </p>

      <form className="filters no-print" action={`/temas/${encodeURIComponent(topic)}`} method="get">
        <select name="branch" defaultValue={sp.branch ?? ""} aria-label="Filtrar por rama">
          <option value="">Todas las ramas</option>
          {Object.entries(BRANCH).map(([value, texto]) => (
            <option key={value} value={value}>
              {texto}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={sp.outcome ?? ""} aria-label="Filtrar por resultado">
          <option value="">Cualquier resultado</option>
          {Object.entries(OUTCOME).map(([value, texto]) => (
            <option key={value} value={value}>
              {texto}
            </option>
          ))}
        </select>
        <button type="submit">Filtrar</button>
        {(sp.branch || sp.outcome) && (
          <Link className="small" href={`/temas/${encodeURIComponent(topic)}`}>
            limpiar
          </Link>
        )}
      </form>
      <PrintButton text="Imprimir la ficha del tema" />

      <h1>Tema: {tema.topic}</h1>
      <p className="lead">
        {tema.cases} casos entre {tema.first.slice(0, 10)} y {tema.last.slice(0, 10)} ·{" "}
        {Object.entries(tema.distribution)
          .map(([key, value]) => `${label(OUTCOME, key)} ${value}`)
          .join(" · ")}
      </p>
      <p className="small">
        <Link href={`/evolucion?tema=${encodeURIComponent(tema.topic)}`}>Cronología →</Link> ·{" "}
        <Link href={`/search?q=${encodeURIComponent(tema.topic)}`}>Buscar el tema en el corpus →</Link>
      </p>

      <div className="section">
        <h2>Casos del tema</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>
                <Link href={conOrden("fecha")}>Fecha</Link>
              </th>
              <th>
                <Link href={conOrden("caso")}>Caso</Link>
              </th>
              <th style={{ width: 150 }}>
                <Link href={conOrden("resultado")}>Resultado</Link>
              </th>
              <th>Frase del tribunal</th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((entry) => (
              <tr key={entry.caseId}>
                <td className="mono small">{entry.fecha || "—"}</td>
                <td className="small">
                  <Link href={`/cases/${entry.caseId}`}>{entry.caseId.replace("case_", "")}</Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.headline.slice(0, 90)}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {label(BRANCH, entry.branch)}
                  </div>
                </td>
                <td>
                  <OutcomeBadge outcome={entry.outcome} />
                </td>
                <td className="small">
                  {entry.frase}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.doctrine}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Qué argumentos se usaron y cómo les fue</h2>
        <p className="small muted">
          Agregado de los argumentos de estos casos. Sirve para priorizar líneas de defensa; es una
          asociación, no una garantía.
        </p>
        {argumentos.length === 0 ? (
          <p className="small muted">Sin argumentos registrados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo de argumento</th>
                <th>Aceptados</th>
                <th>Rechazados</th>
                <th>Parciales</th>
                <th>Sin analizar</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {argumentos.map((argumento) => (
                <tr key={argumento.tipo}>
                  <td className="small">{label(ARG_TYPE, argumento.tipo)}</td>
                  <td>
                    <span className="badge ok">{argumento.aceptados}</span>
                  </td>
                  <td>
                    <span className="badge ko">{argumento.rechazados}</span>
                  </td>
                  <td className="small">{argumento.parciales}</td>
                  <td className="small">{argumento.sinAnalizar}</td>
                  <td className="small">{argumento.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">
          Nota: el desglose por resultado usa el campo <code>outcome</code> de cada argumento (
          {label(ARG_OUTCOME, "ACEPTADO")} / {label(ARG_OUTCOME, "RECHAZADO")}).
        </p>
      </div>

      <div className="section">
        <h2>Leyes citadas en estos casos</h2>
        {leyes.length === 0 ? (
          <p className="small muted">Sin leyes verificadas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Norma</th>
                <th>BOE</th>
                <th>Citas</th>
              </tr>
            </thead>
            <tbody>
              {leyes.map((ley) => (
                <tr key={`${ley.norma}-${ley.boe_id ?? ""}`}>
                  <td className="small">{ley.norma}</td>
                  <td className="mono small">
                    {ley.boe_id ? <Link href={`/laws/${ley.boe_id}`}>{ley.boe_id}</Link> : "—"}
                  </td>
                  <td>{ley.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {frasesTema.length > 0 && (
        <div className="section">
          <h2>Frases del tema (y cómo acabaron)</h2>
          <p className="small muted">
            Frases parecidas dentro de <em>este tema</em> con ≥2 casos del tema y mayoría de
            resultado (≥70%). Misma lógica que en Patrones, pero solo con estos casos.
          </p>
          <ul className="small">
            {frasesTema.map((grupo) => (
              <li key={grupo.ejemplo} style={{ marginBottom: 6 }}>
                «{grupo.ejemplo}»{" "}
                <span className={`badge ${grupo.homogenea >= 90 ? "ok" : "warn"}`}>
                  {grupo.homogenea}% igual
                </span>{" "}
                {Object.entries(grupo.distribucion).map(([outcome, cantidad]) => (
                  <span
                    key={outcome}
                    className={`badge ${outcome === "ESTIMED" ? "ok" : outcome === "DISMISSED" ? "ko" : "warn"}`}
                    style={{ marginRight: 4 }}
                  >
                    {label(OUTCOME, outcome)} {cantidad}
                  </span>
                ))}
                {grupo.casos.slice(0, 4).map((caso) => (
                  <Link
                    key={caso.caseId}
                    href={`/cases/${caso.caseId}`}
                    style={{ marginRight: 6 }}
                    title={caso.headline}
                  >
                    {caso.caseId.replace("case_", "")}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="small muted">
        Ficha generada automáticamente a partir de tu corpus. Los análisis de IA asociados están
        pendientes de validación profesional.
      </p>
    </article>
  );
}
