import { requireActor } from "@/lib/auth";
import Link from "next/link";
import { getCalidadCorpus, getCostesIA, getEvalReport, getSistemaInfo } from "@/lib/dataset";
import { LAW_STATUS, QUOTE, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)} %` : "—";
}

type Dict = Record<string, unknown>;

function asDict(value: unknown): Dict {
  return value && typeof value === "object" ? (value as Dict) : {};
}

export default async function EvalPage() {
  await requireActor();
  const report = await getEvalReport();
  const costes = await getCostesIA();
  const calidad = await getCalidadCorpus();
  const sistema = await getSistemaInfo();
  if (!report) {
    return (
      <>
        <h1>Evaluación</h1>
        <p className="small no-print">
          <a href="/api/export/eval">descargar CSV con todas las métricas</a>
        </p>
        <p className="muted">
          Todavía no hay informe. Ejecuta <span className="mono">pnpm run eval</span>.
        </p>
      </>
    );
  }

  const corpus = asDict(report.corpus);
  const ia = asDict(report.ia);
  const cross = asDict(report.cross_check_outcome);
  const citations = asDict(report.citations);
  const pdf = asDict(citations.pdf_cross_check);
  const golden = asDict(report.golden);

  const crossDetails = (cross.details as Array<Dict>) ?? [];
  const missing = (pdf.missing_in_pdf as Array<Dict>) ?? [];
  const failures = (golden.failures as Array<Dict>) ?? [];
  const byField = asDict(golden.by_field);
  const byStatus = asDict(citations.by_status);
  const byQuote = asDict(citations.by_quote_check);
  const costPerCase = asDict(ia.cost_per_case);

  return (
    <>
      <h1>Evaluación del corpus</h1>
      <p className="lead">
        Informe generado el <span className="mono">{String(report.generated_at ?? "")}</span> por{" "}
        <span className="mono">pnpm run eval</span>. Se regenera solo en cada ejecución.
      </p>

      <div className="grid">
        <div className="card">
          <div className="value">{String(corpus.cases ?? 0)}</div>
          <div className="label">casos en el corpus</div>
        </div>
        <div className="card">
          <div className="value">{String(corpus.enriched ?? 0)}</div>
          <div className="label">enriquecidos con IA</div>
        </div>
        <div className="card">
          <div className="value">{String(corpus.reviewed ?? 0)}</div>
          <div className="label">revisados a mano</div>
        </div>
        <div className="card">
          <div className="value">${String(ia.total_cost ?? 0)}</div>
          <div className="label">coste de IA registrado</div>
        </div>
      </div>

      <h2>Salida (casación) frente a la parte dispositiva del PDF</h2>
      <table>
        <tbody>
          <tr>
            <td>Casos comparables</td>
            <td>{String(cross.total ?? 0)}</td>
          </tr>
          <tr>
            <td>Acuerdo</td>
            <td>
              <strong>
                {String(cross.agreement ?? 0)}/{String(cross.total ?? 0)} (
                {pct(Number(cross.agreement ?? 0), Number(cross.total ?? 0))})
              </strong>
            </td>
          </tr>
          <tr>
            <td>Sin pronunciamiento claro en el PDF</td>
            <td>{String(cross.unknown ?? 0)}</td>
          </tr>
          <tr>
            <td>Desacuerdos</td>
            <td>{String(cross.disagreement ?? 0)}</td>
          </tr>
        </tbody>
      </table>
      {crossDetails.length > 0 && (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Caso</th>
              <th>Dice la IA</th>
              <th>Dicen las reglas del PDF</th>
            </tr>
          </thead>
          <tbody>
            {crossDetails.map((item) => (
              <tr key={String(item.caseId)}>
                <td className="mono small">{String(item.caseId)}</td>
                <td className="small">{String(item.ia)}</td>
                <td className="small">{String(item.reglas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Citas de leyes</h2>
      <table>
        <tbody>
          <tr>
            <td>Citas totales</td>
            <td>{String(citations.total ?? 0)}</td>
          </tr>
          <tr>
            <td>Verificadas contra el catálogo del BOE</td>
            <td>
              <strong>
                {String(citations.verified ?? 0)}/{String(citations.total ?? 0)} (
                {pct(Number(citations.verified ?? 0), Number(citations.total ?? 0))})
              </strong>
            </td>
          </tr>
          <tr>
            <td>Identificadores aportados por la IA</td>
            <td>{String(citations.ai_ids ?? 0)}</td>
          </tr>
          <tr>
            <td>…que no existen en el catálogo (inventados)</td>
            <td>{String(citations.ai_ids_invented ?? 0)}</td>
          </tr>
          <tr>
            <td>Siglas presentes en el propio PDF</td>
            <td>
              {String(pdf.matched ?? 0)}/{String(pdf.checkable ?? 0)} (
              {pct(Number(pdf.matched ?? 0), Number(pdf.checkable ?? 0))})
            </td>
          </tr>
        </tbody>
      </table>

      <div className="grid" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="label">Por estado de la cita</div>
          <table style={{ marginTop: 8 }}>
            <tbody>
              {Object.entries(byStatus).map(([key, value]) => (
                <tr key={key}>
                  <td title={key}>{label(LAW_STATUS, key)}</td>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="label">Comprobación de citas textuales</div>
          <table style={{ marginTop: 8 }}>
            <tbody>
              {Object.entries(byQuote).map(([key, value]) => (
                <tr key={key}>
                  <td title={key}>{label(QUOTE, key)}</td>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {missing.length > 0 && (
        <>
          <h3>Citas que no aparecen literalmente en el PDF (para revisar)</h3>
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Norma citada</th>
              </tr>
            </thead>
            <tbody>
              {missing.map((item, index) => (
                <tr key={`${String(item.caseId)}-${index}`}>
                  <td className="mono small">{String(item.caseId)}</td>
                  <td className="small">{String(item.norma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="section">
        <h2>Calidad del corpus</h2>
        <p className="small muted">
          Qué falta arreglar o revisar en {calidad.total} casos, en un vistazo.
        </p>
        <div className="grid">
          <div className="card">
            <div className="value">{calidad.escaneados.length}</div>
            <div className="label">PDF sin texto extraíble</div>
          </div>
          <div className="card">
            <div className="value">{calidad.stale.length}</div>
            <div className="label">PDF más nuevo que el análisis</div>
          </div>
          <div className="card">
            <div className="value">{calidad.sinEnriquecer.length}</div>
            <div className="label">sin enriquecer</div>
          </div>
          <div className="card">
            <div className="value">{calidad.sinRevisar.length}</div>
            <div className="label">enriquecidos sin revisar</div>
          </div>
        </div>
        {(calidad.escaneados.length > 0 || calidad.stale.length > 0) && (
          <ul className="small" style={{ marginTop: 12 }}>
            {calidad.escaneados.slice(0, 6).map((id) => (
              <li key={`e-${id}`}>
                Sin texto: <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link>
              </li>
            ))}
            {calidad.stale.slice(0, 6).map((id) => (
              <li key={`s-${id}`}>
                Reanalizar: <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h2>Sistema</h2>
        <table>
          <tbody>
            <tr>
              <td className="small">Versión de la app</td>
              <td className="mono small">{sistema.version}</td>
            </tr>
            <tr>
              <td className="small">Commit</td>
              <td className="mono small">{sistema.git ?? "—"}</td>
            </tr>
            <tr>
              <td className="small">Node</td>
              <td className="mono small">{sistema.node}</td>
            </tr>
            <tr>
              <td className="small">Corpus</td>
              <td className="small">
                {sistema.casos} casos ({Math.round(sistema.bytesCases / 1024 / 1024)} MB) ·{" "}
                {sistema.normas} normas ({Math.round(sistema.bytesLaws / 1024 / 1024)} MB)
              </td>
            </tr>
            <tr>
              <td className="small">Última sentencia del corpus</td>
              <td className="mono small">{sistema.ultimaSentencia ?? "—"}</td>
            </tr>
            <tr>
              <td className="small">Última copia de seguridad</td>
              <td className="mono small">
                {sistema.ultimaCopia ?? "ninguna (scripts/backup.ps1)"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Coste en vivo (todos los análisis con IA)</h2>
        <p className="small muted">
          Leído de los JSON de cada caso, no del informe guardado: incluye comparaciones y
          borradores de escrito. Orientativo; el importe real lo factura el proveedor de IA.
        </p>
        <div className="grid">
          <div className="card">
            <div className="value">${costes.total.toFixed(4)}</div>
            <div className="label">total registrado</div>
          </div>
          <div className="card">
            <div className="value">${costes.enriquecerCoste.toFixed(4)}</div>
            <div className="label">{costes.enriquecerCasos} casos enriquecidos</div>
          </div>
          <div className="card">
            <div className="value">${(costes.viasCoste + costes.comparacionCoste + costes.escritoCoste).toFixed(4)}</div>
            <div className="label">
              {costes.viasInformes} vías · {costes.comparaciones} comparaciones · {costes.escritos} borradores
            </div>
          </div>
        </div>
      </div>

      <h2>Coste de IA</h2>
      <table>
        <tbody>
          <tr>
            <td>Enriquecimiento</td>
            <td>
              {String(ia.enrich_cases ?? 0)} casos · {String(ia.enrich_tokens ?? 0)} tokens · $
              {String(ia.enrich_cost ?? 0)}
            </td>
          </tr>
          <tr>
            <td>Por caso</td>
            <td>
              media ${String(costPerCase.avg ?? 0)} · mín ${String(costPerCase.min ?? 0)} · máx $
              {String(costPerCase.max ?? 0)}
            </td>
          </tr>
          <tr>
            <td>Análisis de vías</td>
            <td>
              {String(ia.vias_reports ?? 0)} informes · {String(ia.vias_tokens ?? 0)} tokens · $
              {String(ia.vias_cost ?? 0)}
            </td>
          </tr>
          <tr>
            <td>Resto de pasos (legislación, cruce, patrones, búsqueda…)</td>
            <td>$0</td>
          </tr>
        </tbody>
      </table>

      <h2>Golden dataset</h2>
      <p className="small muted">
        {String(golden.entries ?? 0)} entradas ·{" "}
        <strong>{String(golden.confirmed_entries ?? 0)} confirmadas por una persona</strong> ·{" "}
        {String(golden.auto_entries ?? 0)} automáticas (derivadas del PDF). Campos correctos:{" "}
        {String(golden.passed ?? 0)}/{String(golden.fields ?? 0)}.
      </p>
      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Correctos</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byField).map(([key, value]) => {
            const row = value as { total: number; passed: number };
            return (
              <tr key={key}>
                <td className="small">{key}</td>
                <td>{row.passed}</td>
                <td>{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {failures.length > 0 && (
        <>
          <h3>Fallos pendientes</h3>
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Campo</th>
                <th>Esperado</th>
                <th>Obtenido</th>
                <th>Confirmado</th>
              </tr>
            </thead>
            <tbody>
              {failures.map((item, index) => (
                <tr key={`${String(item.caseId)}-${index}`}>
                  <td className="mono small">{String(item.caseId)}</td>
                  <td className="small">{String(item.field)}</td>
                  <td className="small">{String(item.expected)}</td>
                  <td className="small">{String(item.actual)}</td>
                  <td className="small">{item.confirmed ? "sí" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="notice">
        Las entradas automáticas derivan del propio PDF y no sustituyen la revisión humana. Para
        confirmar una entrada: <span className="mono">pnpm eval:show case_0000XX</span> y después{" "}
        <span className="mono">pnpm run eval -- --confirm=case_0000XX</span>.
      </div>
    </>
  );
}
