import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getCalidadCorpus, getContradicciones, getReviewStats, getVigenciaAlerts } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { jobs } from "@/lib/jobs";
import { SortTh } from "@/lib/sort-th";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("es-ES");
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const sortKey = sp.sort ?? "";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const factor = dir === "desc" ? -1 : 1;
  const cmpTexto = (a: string, b: string) => a.localeCompare(b, "es") * factor;
  const cmpNumero = (a: number, b: number) => (a - b) * factor;
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);

  const [vigenciaBruta, contradictorioBruto, reviewBruto, calidad] = await Promise.all([
    getVigenciaAlerts(),
    getContradicciones(),
    getReviewStats(),
    getCalidadCorpus(),
  ]);
  const vigencia = vigenciaBruta
    .map((alerta) => ({ ...alerta, casos: alerta.casos.filter((caso) => puedeVer(caso.caseId)) }))
    .filter((alerta) => alerta.casos.length > 0);
  const contradictorio = contradictorioBruto
    .map((tema) => ({
      ...tema,
      ejemplos: tema.ejemplos.filter((ejemplo) => puedeVer(ejemplo.caseId)),
    }))
    .filter((tema) => tema.ejemplos.length > 0);

  const vigenciaOrden = [...vigencia].sort((a, b) => {
    if (sortKey === "vig-norma") return cmpTexto(`${a.norma} ${a.titulo}`, `${b.norma} ${b.titulo}`);
    if (sortKey === "vig-casos") return cmpNumero(a.casos.length, b.casos.length);
    return b.casos.length - a.casos.length;
  });
  const temasOrden = [...contradictorio].sort((a, b) => {
    if (sortKey === "tem-tema") return cmpTexto(a.topic, b.topic);
    if (sortKey === "tem-estimados") return cmpNumero(a.estimados, b.estimados);
    if (sortKey === "tem-desestimados") return cmpNumero(a.desestimados, b.desestimados);
    return b.estimados + b.desestimados - (a.estimados + a.desestimados);
  });
  const review = {
    ...reviewBruto,
    pending: reviewBruto.pending.filter((item) => puedeVer(item.id)),
  };
  const stale = calidad.stale.filter(puedeVer);
  const escaneados = calidad.escaneados.filter(puedeVer);
  const fallos = jobs
    .list()
    .filter((job) => job.status === "error")
    .slice()
    .reverse();

  const total =
    contradictorio.length +
    vigencia.length +
    review.pending.length +
    fallos.length +
    stale.length +
    escaneados.length;

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> ·{" "}
        <a href="/api/export/alertas">descargar CSV</a>
      </p>
      <PrintButton text="Imprimir el informe de alertas" />

      <h1>Alertas</h1>
      <p className="lead">
        Señales que piden atención de un letrado: leyes que cambiaron después de tus sentencias,
        temas con criterio dividido, casos sin revisar y trabajos fallidos.{" "}
        <strong>{total} en total.</strong>
      </p>

      <div className="section">
        <h2>Leyes que cambiaron después de la sentencia</h2>
        <p className="small muted">
          El artículo citado por el tribunal tiene hoy una versión distinta: si te apoyas en esa
          cita, comprueba la versión vigente.
        </p>
        {vigencia.length === 0 ? (
          <p className="small">Ninguna alerta: las leyes citadas no han cambiado desde tus sentencias.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh
                  path="/alertas"
                  sortKey="vig-norma"
                  current={sortKey}
                  dir={dir}
                  label="Norma y artículo"
                />
                <th>Versión en la sentencia</th>
                <th>Versión actual</th>
                <SortTh
                  path="/alertas"
                  sortKey="vig-casos"
                  current={sortKey}
                  dir={dir}
                  label="Casos afectados"
                />
              </tr>
            </thead>
            <tbody>
              {vigenciaOrden.map((alerta) => (
                <tr key={`${alerta.boe_id}-${alerta.block_id}`}>
                  <td className="small">
                    <strong>
                      {alerta.norma} {alerta.titulo}
                    </strong>
                    <div className="mono small muted">{alerta.boe_id}</div>
                  </td>
                  <td className="small">{alerta.casos[0]?.version_en_sentencia ?? "—"}</td>
                  <td className="small">
                    <span className="badge warn">{alerta.version_actual}</span>
                  </td>
                  <td className="small">
                    {alerta.casos.slice(0, 3).map((caso, index) => (
                      <div key={caso.caseId}>
                        <Link href={`/cases/${caso.caseId}`}>{caso.headline.slice(0, 60)}</Link>
                        {caso.fecha_sentencia ? ` · ${caso.fecha_sentencia}` : ""}
                      </div>
                    ))}
                    {alerta.casos.length > 3 && (
                      <div className="muted">+{alerta.casos.length - 3} más</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Temas con criterio dividido</h2>
        <p className="small muted">
          El mismo tema resuelto en sentidos opuestos: saber qué argumento es arriesgado. Es una
          asociación, no una predicción.
        </p>
        {contradictorio.length === 0 ? (
          <p className="small">Ningún tema con el criterio dividido de momento.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh
                  path="/alertas"
                  sortKey="tem-tema"
                  current={sortKey}
                  dir={dir}
                  label="Tema"
                />
                <SortTh
                  path="/alertas"
                  sortKey="tem-estimados"
                  current={sortKey}
                  dir={dir}
                  label="Estimados"
                />
                <SortTh
                  path="/alertas"
                  sortKey="tem-desestimados"
                  current={sortKey}
                  dir={dir}
                  label="Desestimados"
                />
                <th>Ejemplos</th>
              </tr>
            </thead>
            <tbody>
              {temasOrden.map((tema) => (
                <tr key={tema.topic}>
                  <td>
                    <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link>
                  </td>
                  <td>
                    <span className="badge ok">{tema.estimados}</span>
                  </td>
                  <td>
                    <span className="badge ko">{tema.desestimados}</span>
                  </td>
                  <td className="small">
                    {tema.ejemplos.slice(0, 2).map((ejemplo) => (
                      <div key={ejemplo.caseId}>
                        <Link href={`/cases/${ejemplo.caseId}`}>{ejemplo.headline.slice(0, 55)}</Link>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Casos pendientes de revisión</h2>
        {review.pending.length === 0 ? (
          <p className="small">Todo revisado.</p>
        ) : (
          <>
            <p className="small muted">
              {review.pending.length} casos enriquecidos sin revisar de {review.total}.
            </p>
            <ul className="small">
              {review.pending.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <Link href={`/cases/${item.id}`}>{item.headline}</Link>
                </li>
              ))}
            </ul>
            <p className="small">
              <Link href="/review">Ir al panel de revisión →</Link>
            </p>
          </>
        )}
      </div>

      {(stale.length > 0 || escaneados.length > 0) && (
        <div className="section">
          <h2>PDFs con problemas</h2>
          <p className="small muted">
            El PDF cambió desde el análisis o no se le pudo extraer texto: toca reanalizarlos.
          </p>
          <ul className="small">
            {stale.map((id) => (
              <li key={`s-${id}`}>
                <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link> — el PDF es más nuevo
                que el análisis
              </li>
            ))}
            {escaneados.map((id) => (
              <li key={`e-${id}`}>
                <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link> — sin texto extraíble
                (posible escaneo)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section">
        <h2>Trabajos con error</h2>
        <p className="small muted">
          Solo se ven los de esta sesión de la aplicación (se borran al reiniciar).
        </p>
        {fallos.length === 0 ? (
          <p className="small">Sin fallos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Cuándo</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {fallos.map((job) => (
                <tr key={job.id}>
                  <td className="small">
                    {job.kind}
                    {job.caseId ? ` · ${job.caseId}` : ""}
                  </td>
                  <td className="small">{fecha(job.startedAt)}</td>
                  <td className="small" style={{ color: "var(--red)" }}>
                    {(job.error ?? "").slice(0, 300)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </article>
  );
}
