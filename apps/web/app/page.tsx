import Link from "next/link";
import { Bar } from "@/components/bar";
import { canViewCase, contextoVisibilidad, loadIdentity } from "@/lib/auth";
import { computePatterns, diasSinTocar, getAuditoria, getLawUsage, getReviewStats, getVigenciaAlerts, listCases, listLaws } from "@/lib/dataset";
import { AUDIT, OUTCOME, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

function groupCount(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function Home() {
  const { actor, orgId, grants } = await contextoVisibilidad();
  const all = await listCases();
  const cases = all.filter((item) => canViewCase(actor, item.id, orgId, grants));
  const caseIds = cases.map((item) => item.id);

  const [usage, patterns, laws, reviewStats, vigencia] = await Promise.all([
    getLawUsage(caseIds),
    computePatterns(caseIds),
    listLaws(),
    getReviewStats(),
    getVigenciaAlerts(),
  ]);

  const pendientes = reviewStats.pending.filter((item) => canViewCase(actor, item.id, orgId, grants));
  const siguiente =
    reviewStats.next && canViewCase(actor, reviewStats.next.id, orgId, grants)
      ? reviewStats.next
      : null;
  const leyesCambiadas = vigencia.filter((alerta) =>
    alerta.casos.some((caso) => canViewCase(actor, caso.caseId, orgId, grants)),
  ).length;

  const outcomes = groupCount(cases.map((item) => item.outcome));
  const analyzed = patterns?.cases_analyzed ?? 0;
  const frios = cases.filter(
    (item) => item.reviewStatus === "UNREVIEWED" && diasSinTocar(item) > 30,
  ).length;

  const hoyStr = new Date().toISOString().slice(0, 10);
  // Actividad de auditoría del día, acotada a lo que a ti te toca: los
  // registros con recurso-caso pasan por `canViewCase` y el resto solo si el
  // actor es un usuario de MISOS despachos (los intentos de login fallidos
  // van con el correo escrito, no con un userId, así que no se cuentan aquí).
  const identity = await loadIdentity();
  const mios = new Set(
    identity
      .listMemberships()
      .filter((membresia) => actor.orgIds.includes(membresia.firmId))
      .map((membresia) => membresia.userId),
  );
  const actividadHoy = (await getAuditoria(300)).filter((entrada) => {
    if ((entrada.at ?? "").slice(0, 10) !== hoyStr) return false;
    const recurso = entrada.resource ?? "";
    if (recurso.startsWith("case_")) return canViewCase(actor, recurso, orgId, grants);
    return entrada.actor === actor.userId || mios.has(entrada.actor) || mios.has(recurso);
  });
  const porAccion = new Map<string, number>();
  for (const entrada of actividadHoy) {
    porAccion.set(entrada.action, (porAccion.get(entrada.action) ?? 0) + 1);
  }

  return (
    <>
      <h1>Corpus jurídico</h1>
      <p className="lead">
        Sentencias estructuradas por IA, cruzadas con el texto consolidado del BOE y agregadas en
        patrones de resultado.
      </p>

      <div className="grid">
        <div className="card">
          <div className="value">{cases.length}</div>
          <div className="label">casos visibles para ti</div>
        </div>
        <div className="card">
          <div className="value">{cases.filter((item) => item.enriched).length}</div>
          <div className="label">enriquecidos con IA</div>
        </div>
        <div className="card">
          <div className="value">{laws.length}</div>
          <div className="label">normas BOE con texto</div>
        </div>
        <div className="card">
          <div className="value">{analyzed}</div>
          <div className="label">casos con patrones</div>
        </div>
        <div className="card">
          <div className="value">
            <Link href="/cases?sort=dias&dir=desc">{frios}</Link>
          </div>
          <div className="label">sin tocar más de 30 días</div>
        </div>
      </div>

      <div className="section">
        <h2>Accesos directos</h2>
        <ul className="small">
          <li>
            <Link href="/alertas">Alertas</Link> — {leyesCambiadas} leyes cambiadas tras tus
            sentencias y {pendientes.length} casos sin revisar
          </li>
          <li>
            <Link href="/review">Revisión humana</Link>
            {siguiente ? (
              <>
                {" "}
                - siguiente pendiente:{" "}
                <Link href={`/cases/${siguiente.id}`}>{siguiente.id}</Link>
              </>
            ) : (
              " — todo revisado"
            )}
          </li>
          <li>
            <Link href="/informes">Informe del periodo</Link> — sentencias, temas y normas del mes,
            listo para imprimir
          </li>
          <li>
            <Link href="/search">Búsqueda</Link> — texto libre o identificador exacto (ECLI, ROJ, nº
            de recurso)
          </li>
          <li>
            <Link href="/plazos">Plazos procesales</Link> — cómputo con la LEC verificada contra el
            BOE
          </li>
          <li>
            <Link href="/novedades">Novedades</Link> — qué se ha ido añadiendo a la plataforma
          </li>
          <li>
            <Link href="/resumen">Resumen imprimible</Link> — lo del día en una hoja A4
          </li>
          <li>
            <Link href="/clientes">Clientes</Link> — casos agrupados por cliente o encargo (se
            asigna en cada ficha)
          </li>
        </ul>
      </div>

      {actividadHoy.length > 0 && (
        <div className="section">
          <h2>Hoy en la plataforma</h2>
          <p className="small muted">Actividad registrada hoy (auditoría del día).</p>
          <ul className="small">
            {[...porAccion.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([accion, cantidad]) => (
                <li key={accion}>
                  {label(AUDIT, accion)} · {cantidad}
                </li>
              ))}
          </ul>
          <p className="small">
            <Link href="/users">Ver la auditoría completa →</Link>
          </p>
        </div>
      )}

      <div className="section">
        <h2>Últimos analizados</h2>
        <ul className="small">
          {[...cases]
            .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))
            .slice(0, 5)
            .map((caso) => (
              <li key={caso.id}>
                <span className="mono small">{caso.generatedAt.slice(0, 10) || "—"}</span>{" "}
                <Link href={`/cases/${caso.id}`}>
                  {caso.headline.length > 90 ? `${caso.headline.slice(0, 90)}…` : caso.headline}
                </Link>
              </li>
            ))}
        </ul>
      </div>

      <h2>Resultados (casación)</h2>
      <table>
        <thead>
          <tr>
            <th>Resultado</th>
            <th>Casos</th>
            <th style={{ width: 180 }}>Proporción</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((row) => (
            <tr key={row.name}>
              <td title={row.name}>{label(OUTCOME, row.name)}</td>
              <td>{row.count}</td>
              <td>
                <Bar
                  value={row.count}
                  max={outcomes[0]?.count ?? 1}
                  tone={
                    row.name === "ESTIMED"
                      ? "ok"
                      : row.name === "DISMISSED"
                        ? "ko"
                        : "accent"
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Normas más citadas en tus casos</h2>
      <table>
        <thead>
          <tr>
            <th>Norma</th>
            <th>Citas</th>
            <th>Casos</th>
          </tr>
        </thead>
        <tbody>
          {usage.byNorm.slice(0, 8).map((row) => (
            <tr key={row.boe_id}>
              <td>
                <Link href={`/laws/${row.boe_id}`}>{row.titulo}</Link>
              </td>
              <td>{row.citations}</td>
              <td>{row.cases.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Artículos más citados</h2>
      <table>
        <thead>
          <tr>
            <th>Artículo</th>
            <th>Norma</th>
            <th>Citas</th>
            <th>Casos</th>
          </tr>
        </thead>
        <tbody>
          {usage.byArticle.slice(0, 8).map((row) => (
            <tr key={`${row.boe_id}-${row.article}`}>
              <td className="mono">art. {row.article}</td>
              <td className="small">{row.titulo}</td>
              <td>{row.citations}</td>
              <td>{row.cases.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="notice">
        Estas cifras son <strong>asociaciones observadas</strong> en el corpus disponible, no
        predicciones. La revisión de un abogado es imprescindible.
      </div>

    </>
  );
}
