import Link from "next/link";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getEvolucion } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function EvolucionPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const sp = await searchParams;
  const brutas = await getEvolucion();
  const temas = brutas
    .map((tema) => {
      const entries = tema.entries.filter((entry) =>
        canViewCase(actor, entry.caseId, orgId, grants),
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

  return (
    <>
      <h1>Evolución jurisprudencial</h1>
      <p className="lead">
        Cómo ha ido evolucionando cada tema (<em>ratio decidendi</em>) a lo largo del corpus, con
        su fecha, su resultado y la frase del tribunal. Solo temas con 3 casos o más.
      </p>

      {temas.length === 0 && <p className="muted">No hay temas con suficientes casos.</p>}

      {temas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) 2fr", gap: 20 }}>
          <div>
            <h2>Temas</h2>
            <table>
              <thead>
                <tr>
                  <th>Tema</th>
                  <th>Casos</th>
                  <th>Periodo</th>
                </tr>
              </thead>
              <tbody>
                {temas.map((tema) => (
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
                <p className="small">
                  <Link href={`/temas/${encodeURIComponent(activo.topic)}`}>
                    Ficha completa del tema (argumentos y leyes) →
                  </Link>
                </p>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Fecha</th>
                      <th>Caso</th>
                      <th style={{ width: 150 }}>Resultado</th>
                      <th>Frase del tribunal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activo.entries.map((entry) => (
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
    </>
  );
}
