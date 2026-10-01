import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { CompareReport } from "@pipeline/compare";
import { PrintButton } from "@/components/print-button";
import { CopyButton } from "@/components/copy-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getCase, getComparisons } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { ARG_OUTCOME, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function CompareReportPage({
  params,
}: {
  params: Promise<{ id: string; other: string }>;
}) {
  const { id, other } = await params;
  if (!/^case_\d{6}$/.test(id) || !/^case_\d{6}$/.test(other)) notFound();
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  if (!canViewCase(actor, id, orgId, grants) || !canViewCase(actor, other, orgId, grants)) {
    redirect("/cases");
  }

  const [a, b, comparisons] = await Promise.all([getCase(id), getCase(other), getComparisons(id)]);
  if (!a || !b) notFound();
  const comparison = comparisons.find((item) => item.otro_caso === other);
  const report = comparison?.report as CompareReport | undefined;

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href={`/cases/${id}`}>← Volver a la ficha</Link>
      </p>
      <PrintButton />

      <h1 style={{ marginTop: 0 }}>Informe comparativo</h1>
      <p className="small">
        <strong>Caso base:</strong>{" "}
        <Link href={`/cases/${id}`}>
          {a.headline} <span className="mono">({id})</span>
        </Link>
        <br />
        <strong>Caso de referencia:</strong>{" "}
        <Link href={`/cases/${other}`}>
          {b.headline} <span className="mono">({other})</span>
        </Link>
        {comparison?.generated_at && (
          <>
            <br />
            <strong>Generado:</strong> {new Date(comparison.generated_at).toLocaleString("es-ES")}
            {typeof comparison.analysis?.cost === "number"
              ? ` · coste $${comparison.analysis.cost.toFixed(4)}`
              : ""}
          </>
        )}
      </p>

      {!report ? (
        <p className="small">
          Todavía no hay comparación entre estos dos casos. Se genera desde la ficha del caso{" "}
          <Link href={`/cases/${id}`}>{id}</Link>.
        </p>
      ) : (
        <>
          <p>
            <span
              className={`badge ${report.aplicabilidad === "ALTA" ? "ok" : report.aplicabilidad === "MEDIA" ? "warn" : ""}`}
            >
              Aplicabilidad {report.aplicabilidad ?? "—"}
            </span>
          </p>
          {report.conclusion && <blockquote>{report.conclusion}</blockquote>}
          {report.conclusion && (
            <p className="no-print" style={{ marginTop: 4 }}>
              <CopyButton texto={report.conclusion} etiqueta="Copiar conclusión" />
            </p>
          )}

          {(report.similitudes?.length ?? 0) > 0 && (
            <>
              <h2>Similitudes</h2>
              <ul className="small">
                {report.similitudes?.map((item, index) => (
                  <li key={index}>
                    <strong>{item.aspecto}:</strong> {item.detalle}{" "}
                    {item.apoyo_case_id?.startsWith("case_") && (
                      <Link href={`/cases/${item.apoyo_case_id}`}>{item.apoyo_case_id}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(report.diferencias?.length ?? 0) > 0 && (
            <>
              <h2>Diferencias</h2>
              <ul className="small">
                {report.diferencias?.map((item, index) => (
                  <li key={index}>
                    <strong>{item.aspecto}:</strong> {item.detalle}{" "}
                    {item.impacto && <em>(impacto: {item.impacto})</em>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(report.argumentos_efectivos?.length ?? 0) > 0 && (
            <>
              <h2>Argumentos efectivos</h2>
              <ul className="small">
                {report.argumentos_efectivos?.map((item, index) => (
                  <li key={index}>
                    <span className="badge">{label(ARG_OUTCOME, item.resultado)}</span> {item.argumento}{" "}
                    {item.apoyo_case_id?.startsWith("case_") && (
                      <Link href={`/cases/${item.apoyo_case_id}`}>({item.apoyo_case_id})</Link>
                    )}
                    {item.apoyo_frase && item.apoyo_frase !== "UNKNOWN" && (
                      <div className="muted">“{item.apoyo_frase}”</div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(report.huecos?.length ?? 0) > 0 && (
            <>
              <h2>Huecos del expediente</h2>
              <table>
                <thead>
                  <tr>
                    <th>Qué falta</th>
                    <th>Cómo cubrirlo</th>
                  </tr>
                </thead>
                <tbody>
                  {report.huecos?.map((item, index) => (
                    <tr key={index}>
                      <td className="small">{item.descripcion}</td>
                      <td className="small">{item.como_cubrirlo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(report.contraargumentos?.length ?? 0) > 0 && (
            <>
              <h2>Contraargumentos previstos</h2>
              <ul className="small">
                {report.contraargumentos?.map((item, index) => (
                  <li key={index}>
                    <strong>Dirán:</strong> {item.del_contrario}
                    <br />
                    <strong>Respondemos:</strong> {item.nuestra_respuesta}{" "}
                    {item.apoyo_case_id?.startsWith("case_") && (
                      <Link href={`/cases/${item.apoyo_case_id}`}>{item.apoyo_case_id}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {(report.riesgos?.length ?? 0) > 0 && (
            <>
              <h2>Riesgos</h2>
              <ul className="small">
                {report.riesgos?.map((riesgo, index) => (
                  <li key={index}>{riesgo}</li>
                ))}
              </ul>
            </>
          )}

          {(report.avisos?.length ?? 0) > 0 && (
            <>
              <h2>Avisos del análisis</h2>
              <ul className="small muted">
                {report.avisos?.map((aviso, index) => (
                  <li key={index}>{aviso}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="small muted">
        Informe generado por MantiJudicial con asistencia de IA a partir de dos sentencias de tu
        corpus. Es material de trabajo para el letrado: no constituye asesoramiento ni sustituye la
        revisión profesional. Las notas privadas del abogado no se incluyen.
      </p>
    </article>
  );
}
