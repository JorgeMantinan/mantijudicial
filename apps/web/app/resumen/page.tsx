import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getContradicciones, getReviewStats, getVigenciaAlerts, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const dynamic = "force-dynamic";

export default async function ResumenPage() {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);

  const [todos, stats, vigencia, contradictorio] = await Promise.all([
    listCases(),
    getReviewStats(),
    getVigenciaAlerts(),
    getContradicciones(),
  ]);

  const casos = todos.filter((item) => puedeVer(item.id));
  const pendientes = stats.pending.filter((item) => puedeVer(item.id));
  const leyes = vigencia.filter((alerta) => alerta.casos.some((caso) => puedeVer(caso.caseId)));
  const temas = contradictorio.filter((tema) =>
    tema.ejemplos.some((ejemplo) => puedeVer(ejemplo.caseId)),
  );
  const revisados = (stats.byStatus.REVIEWED ?? 0) + (stats.byStatus.MODIFIED ?? 0);
  const hoy = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> · <Link href="/alertas">Alertas</Link> ·{" "}
        <Link href="/informes">Informes</Link>
      </p>
      <PrintButton text="Imprimir el resumen" />

      <h1 style={{ marginTop: 0 }}>Resumen del día</h1>
      <p className="small">{hoy} · MantiJudicial</p>

      <div className="grid">
        <div className="card">
          <div className="value">{casos.length}</div>
          <div className="label">casos en el corpus</div>
        </div>
        <div className="card">
          <div className="value">{pendientes.length}</div>
          <div className="label">pendientes de revisar</div>
        </div>
        <div className="card">
          <div className="value">{revisados}</div>
          <div className="label">revisados (o corregidos)</div>
        </div>
        <div className="card">
          <div className="value">{leyes.length + temas.length}</div>
          <div className="label">alertas activas</div>
        </div>
      </div>

      <div className="section">
        <h2>Siguientes a revisar</h2>
        {pendientes.length === 0 ? (
          <p className="small">Nada pendiente: todo revisado.</p>
        ) : (
          <ol className="small">
            {pendientes.slice(0, 10).map((item) => (
              <li key={item.id}>
                <Link href={`/cases/${item.id}`}>{item.headline}</Link>
              </li>
            ))}
            {pendientes.length > 10 && <li>… y {pendientes.length - 10} más</li>}
          </ol>
        )}
      </div>

      <div className="section">
        <h2>Leyes que cambiaron después de la sentencia</h2>
        {leyes.length === 0 ? (
          <p className="small">Sin alertas de vigencia.</p>
        ) : (
          <ul className="small">
            {leyes.slice(0, 6).map((alerta) => (
              <li key={`${alerta.boe_id}-${alerta.block_id}`}>
                {alerta.norma} {alerta.titulo} — versión actual {alerta.version_actual} (
                {alerta.casos.length} caso{alerta.casos.length === 1 ? "" : "s"})
              </li>
            ))}
            {leyes.length > 6 && <li>… y {leyes.length - 6} más</li>}
          </ul>
        )}
      </div>

      <div className="section">
        <h2>Temas con criterio dividido</h2>
        {temas.length === 0 ? (
          <p className="small">Sin temas divididos con casos visibles.</p>
        ) : (
          <ul className="small">
            {temas.slice(0, 6).map((tema) => (
              <li key={tema.topic}>
                <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link> —{" "}
                {tema.estimados} estimados / {tema.desestimados} desestimados
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="small muted">
        Resumen informativo generado por MantiJudicial sobre tu corpus. Las cifras son
        asociaciones observadas, no predicciones; requieren revisión profesional.
      </p>
    </article>
  );
}
