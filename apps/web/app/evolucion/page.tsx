import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getEvolucion } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, OUTCOME, label } from "@/lib/labels";
import { SortTh } from "@/lib/sort-th";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function EvolucionPage({
  searchParams,
}: {
  searchParams: Promise<{
    tema?: string;
    branch?: string;
    outcome?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const sp = await searchParams;
  const branchFiltro = sp.branch ?? "";
  const outcomeFiltro = sp.outcome ?? "";
  const brutas = await getEvolucion();
  const temas = brutas
    .map((tema) => {
      const entries = tema.entries.filter(
        (entry) =>
          canViewCase(actor, entry.caseId, orgId, grants) &&
          (!branchFiltro || entry.branch === branchFiltro) &&
          (!outcomeFiltro || entry.outcome === outcomeFiltro),
      );
      const distribution: Record<string, number> = {};
      for (const entry of entries) {
        distribution[entry.outcome] = (distribution[entry.outcome] ?? 0) + 1;
      }
      const fechas = entries.map((entry) => entry.fecha).sort();
      return {
        ...tema,
        entries,
        cases: entries.length,
        distribution,
        first: fechas[0] ?? tema.first,
        last: fechas[fechas.length - 1] ?? tema.last,
      };
    })
    .filter((tema) => tema.cases > 0);
  const activo =
    (sp.tema ? temas.find((item) => item.topic === sp.tema) : undefined) ?? temas[0] ?? null;

  const sortKey = sp.sort ?? "";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const factor = dir === "desc" ? -1 : 1;
  const cmpTexto = (a: string, b: string) => a.localeCompare(b, "es") * factor;
  const cmpNumero = (a: number, b: number) => (a - b) * factor;
  const base = { branch: sp.branch, outcome: sp.outcome, tema: sp.tema };
  const temasOrden = [...temas].sort((a, b) => {
    if (sortKey === "t-tema") return cmpTexto(a.topic, b.topic);
    if (sortKey === "t-casos") return cmpNumero(a.cases, b.cases);
    if (sortKey === "t-periodo") return cmpTexto(a.first, b.first);
    return b.cases - a.cases;
  });
  const entradas = activo
    ? [...activo.entries].sort((a, b) => {
        if (sortKey === "e-caso") return cmpTexto(a.caseId, b.caseId);
        if (sortKey === "e-res") return cmpTexto(a.outcome, b.outcome);
        if (sortKey === "e-fecha") return cmpTexto(a.fecha, b.fecha);
        return a.fecha.localeCompare(b.fecha);
      })
    : [];

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> · <Link href="/alertas">Alertas</Link> ·{" "}
        <Link href="/informes">Informes</Link>
      </p>
      <PrintButton text="Imprimir la evolución" />

      <h1>Evolución jurisprudencial</h1>
      <p className="lead">
        Cómo ha ido evolucionando cada tema (<em>ratio decidendi</em>) a lo largo del corpus, con
        su fecha, su resultado y la frase del tribunal. Solo temas con 3 casos o más.
      </p>

      <form className="filters no-print" action="/evolucion" method="get">
        {sp.tema && <input type="hidden" name="tema" value={sp.tema} />}
        <select name="branch" defaultValue={branchFiltro} aria-label="Filtrar por rama">
          <option value="">Todas las ramas</option>
          {Object.entries(BRANCH).map(([value, texto]) => (
            <option key={value} value={value}>
              {texto}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={outcomeFiltro} aria-label="Filtrar por resultado">
          <option value="">Cualquier resultado</option>
          {Object.entries(OUTCOME).map(([value, texto]) => (
            <option key={value} value={value}>
              {texto}
            </option>
          ))}
        </select>
        <button type="submit">Filtrar</button>
        {(branchFiltro || outcomeFiltro) && (
          <Link className="small" href="/evolucion">
            limpiar
          </Link>
        )}
      </form>

      {temas.length === 0 && <p className="muted">No hay temas con suficientes casos.</p>}

      {temas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: 20 }}>
          <div>
            <h2>Temas</h2>
            <table>
              <thead>
                <tr>
                  <SortTh path="/evolucion" sortKey="t-tema" current={sortKey} dir={dir} label="Tema" base={base} />
                  <SortTh path="/evolucion" sortKey="t-casos" current={sortKey} dir={dir} label="Casos" base={base} />
                  <SortTh path="/evolucion" sortKey="t-periodo" current={sortKey} dir={dir} label="Periodo" base={base} />
                </tr>
              </thead>
              <tbody>
                {temasOrden.map((tema) => (
                  <tr
                    key={tema.topic}
                    style={
                      activo?.topic === tema.topic
                        ? { background: "var(--panel-2)" }
                        : undefined
                    }
                  >
                    <td>
                      <Link href={`/evolucion?tema=${encodeURIComponent(tema.topic)}`}>
                        {tema.topic}
                      </Link>
                    </td>
                    <td>{tema.cases}</td>
                    <td className="small">
                      {tema.first.slice(0, 10)} → {tema.last.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            {activo && (
              <>
                <h2>
                  {activo.topic}{" "}
                  <span className="badge">
                    {activo.cases} casos ·{" "}
                    {Object.entries(activo.distribution)
                      .map(([k, v]) => `${label(OUTCOME, k)} ${v}`)
                      .join(" · ")}
                  </span>
                </h2>
                <p className="small no-print">
                  <Link href={`/temas/${encodeURIComponent(activo.topic)}`}>
                    <button type="button" style={{ fontSize: 13 }}>
                      Ficha del tema (argumentos y leyes) →
                    </button>
                  </Link>
                </p>
                <table>
                  <thead>
                    <tr>
                      <SortTh path="/evolucion" sortKey="e-fecha" current={sortKey} dir={dir} label="Fecha" base={base} />
                      <SortTh path="/evolucion" sortKey="e-caso" current={sortKey} dir={dir} label="Caso" base={base} />
                      <SortTh path="/evolucion" sortKey="e-res" current={sortKey} dir={dir} label="Resultado" base={base} />
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
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
