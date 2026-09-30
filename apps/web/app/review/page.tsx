import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { getReviewStats, listCases } from "@/lib/dataset";
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
        </p>
      )}

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
