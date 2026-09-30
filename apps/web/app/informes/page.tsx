import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getInforme } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

function fechaLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function validar(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const sp = await searchParams;
  const hoy = fechaLocal(new Date());
  const mesInicio = fechaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const desde = validar(sp.desde, mesInicio);
  const hasta = validar(sp.hasta, hoy);

  const informe = await getInforme(desde, hasta, (caseId) =>
    canViewCase(actor, caseId, orgId, grants),
  );

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/alertas">← Alertas</Link> ·{" "}
        <Link href="/evolucion">Evolución</Link>
      </p>
      <PrintButton text="Imprimir el informe" />

      <h1 style={{ marginTop: 0 }}>Informe del periodo</h1>
      <p className="small">
        Sentencias resueltas entre <strong>{desde}</strong> y <strong>{hasta}</strong> · generado el{" "}
        {new Date().toLocaleString("es-ES")}
      </p>

      <form className="filters no-print" action="/informes" method="get">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Desde
          <input type="date" name="desde" defaultValue={desde} />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} />
        </label>
        <button type="submit" style={{ marginTop: 18 }}>
          Actualizar
        </button>
      </form>

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="value">{informe.casos.length}</div>
          <div className="label">sentencias en el periodo</div>
        </div>
        <div className="card">
          <div className="value">{informe.pendientes}</div>
          <div className="label">pendientes de revisar</div>
        </div>
        <div className="card">
          <div className="value">{informe.temas.length}</div>
          <div className="label">temas activos</div>
        </div>
        <div className="card">
          <div className="value">{informe.leyes.length}</div>
          <div className="label">normas citadas (top)</div>
        </div>
      </div>

      <div className="section">
        <h2>Resultado y rama</h2>
        <p className="small">
          {Object.entries(informe.porResultado)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => `${label(OUTCOME, key)}: ${value}`)
            .join(" · ")}
        </p>
        <p className="small muted">
          {Object.entries(informe.porRama)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => `${label(BRANCH, key)}: ${value}`)
            .join(" · ")}
        </p>
      </div>

      <div className="section">
        <h2>Temas más trabajados</h2>
        {informe.temas.length === 0 ? (
          <p className="small muted">Sin temas con 2 casos o más en el periodo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                <th>Casos</th>
                <th>Distribución</th>
              </tr>
            </thead>
            <tbody>
              {informe.temas.map((tema) => (
                <tr key={tema.topic}>
                  <td className="small">
                    <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link>
                  </td>
                  <td>{tema.casos}</td>
                  <td className="small">
                    {Object.entries(tema.distribution)
                      .map(([key, value]) => `${label(OUTCOME, key)} ${value}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Temas por {informe.periodos[0]?.includes("-T") ? "trimestre" : "mes"}</h2>
        <p className="small muted">
          Cuántos casos de cada tema caen en cada periodo. Ayuda a ver la tendencia; es una
          asociación observada, no una predicción.
        </p>
        {informe.matriz.length === 0 ? (
          <p className="small muted">Sin temas en el periodo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                {informe.periodos.map((periodo) => (
                  <th key={periodo} style={{ textAlign: "right" }}>
                    {periodo}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {informe.matriz.map((fila) => (
                <tr key={fila.topic}>
                  <td className="small">
                    <Link href={`/temas/${encodeURIComponent(fila.topic)}`}>{fila.topic}</Link>
                  </td>
                  {informe.periodos.map((periodo) => (
                    <td key={periodo} className="small" style={{ textAlign: "right" }}>
                      {fila.celdas[periodo] ?? <span className="muted">·</span>}
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>
                    <strong>{fila.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Normas más citadas</h2>
        {informe.leyes.length === 0 ? (
          <p className="small muted">Sin citas verificadas en el periodo.</p>
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
              {informe.leyes.map((ley) => (
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

      <div className="section">
        <h2>Sentencias del periodo</h2>
        {informe.casos.length === 0 ? (
          <p className="small muted">No hay sentencias con fecha de resolución en ese rango.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Fecha</th>
                <th>Caso</th>
                <th style={{ width: 150 }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {informe.casos.map((caso) => (
                <tr key={caso.id}>
                  <td className="mono small">{caso.fecha}</td>
                  <td className="small">
                    <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                  </td>
                  <td>
                    <OutcomeBadge outcome={caso.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small muted">
        Informe generado por MantiJudicial a partir de tu corpus. Los análisis asistidos por IA
        pendientes de revisión se señalan en la ficha de cada caso.
      </p>
    </article>
  );
}
