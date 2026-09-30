import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { getRevisionPorPersona, getReviewStats, listCases } from "@/lib/dataset";
import { BRANCH, OUTCOME, REVIEW, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireActor();
  const params = await searchParams;
  const status = params.status ?? "UNREVIEWED";
  const stats = await getReviewStats(true);
  const carga = await getRevisionPorPersona();
  const all = await listCases();
  const filtered = all.filter((item) => (status === "TODOS" ? true : item.reviewStatus === status));

  return (
    <>
      <h1>Revisión humana</h1>
      <p className="lead">
        El análisis lo produce la IA; aquí se registra que una persona lo ha verificado. Es lo que
        da validez interna a un caso antes de enseñárselo a un cliente.
      </p>

      <div className="grid">
        <div className="card">
          <div className="value">{stats.pending.length}</div>
          <div className="label">pendientes de revisar</div>
        </div>
        <div className="card">
          <div className="value">{stats.byStatus.REVIEWED ?? 0}</div>
          <div className="label">revisados</div>
        </div>
        <div className="card">
          <div className="value">{stats.byStatus.MODIFIED ?? 0}</div>
          <div className="label">revisados y modificados</div>
        </div>
        <div className="card">
          <div className="value">{stats.byStatus.REJECTED ?? 0}</div>
          <div className="label">rechazados</div>
        </div>
      </div>

      {stats.next && (
        <p style={{ marginTop: 18 }}>
          <Link href={`/cases/${stats.next.id}`}>
            <button type="button">Siguiente a revisar: {stats.next.id} →</button>
          </Link>
          <span className="small muted" style={{ marginLeft: 10 }}>
            en la ficha puedes guardar y pulsar <strong>N</strong> para pasar al siguiente
          </span>
        </p>
      )}

      <div className="section">
        <h2>Carga de revisión por persona</h2>
        {carga.personas.length === 0 ? (
          <p className="small muted">Todavía no consta quién ha revisado nada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Casos revisados</th>
                <th>Estados</th>
                <th>Última revisión</th>
              </tr>
            </thead>
            <tbody>
              {carga.personas.map((persona) => (
                <tr key={persona.persona}>
                  <td className="small">{persona.persona}</td>
                  <td>
                    <span className="badge ok">{persona.casos}</span>
                  </td>
                  <td className="small">
                    {Object.entries(persona.estados)
                      .map(([estado, count]) => `${label(REVIEW, estado)} ${count}`)
                      .join(" · ")}
                  </td>
                  <td className="small">{persona.ultimo ? new Date(persona.ultimo).toLocaleDateString("es-ES") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {carga.sinRevisador > 0 && (
          <p className="small muted">
            {carga.sinRevisador} casos con estado revisado pero sin indicar quién: rellena el campo
            «Revisado por».
          </p>
        )}
      </div>

      <form className="filters" action="/review" method="get">
        <select name="status" defaultValue={status}>
          <option value="UNREVIEWED">Sin revisar ({stats.pending.length})</option>
          <option value="REVIEWED">Revisados ({stats.byStatus.REVIEWED ?? 0})</option>
          <option value="MODIFIED">Revisados y modificados ({stats.byStatus.MODIFIED ?? 0})</option>
          <option value="REJECTED">Rechazados ({stats.byStatus.REJECTED ?? 0})</option>
          <option value="TODOS">Todos ({stats.total})</option>
        </select>
        <button type="submit">Ver</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>Caso</th>
            <th>Asunto</th>
            <th>Rama</th>
            <th>Resultado</th>
            <th>Revisión</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id}>
              <td className="mono">{item.id.replace("case_", "")}</td>
              <td>{item.headline}</td>
              <td className="small">{label(BRANCH, item.branch)}</td>
              <td>
                <OutcomeBadge outcome={item.outcome} />
              </td>
              <td>
                <span
                  className={`badge ${item.reviewStatus === "UNREVIEWED" ? "warn" : item.reviewStatus === "REJECTED" ? "ko" : "ok"}`}
                  title={item.reviewStatus}
                >
                  {label(REVIEW, item.reviewStatus)}
                </span>
              </td>
              <td>
                <Link href={`/cases/${item.id}`}>abrir →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filtered.length === 0 && <p className="muted">No hay casos con ese estado.</p>}
    </>
  );
}
