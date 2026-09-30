import Link from "next/link";
import { Bar } from "@/components/bar";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getRevisionPorPersona, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, REVIEW, label } from "@/lib/labels";
import { ReviewTable } from "./review-table";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const params = await searchParams;
  const status = params.status ?? "UNREVIEWED";
  const carga = await getRevisionPorPersona();
  const all = (await listCases()).filter((item) => canViewCase(actor, item.id, orgId, grants));
  const pendientes = all.filter((item) => item.enriched && item.reviewStatus === "UNREVIEWED");
  const porEstado: Record<string, number> = {};
  for (const item of all) porEstado[item.reviewStatus] = (porEstado[item.reviewStatus] ?? 0) + 1;
  const siguiente = pendientes[0] ?? null;
  const porRama = new Map<string, { total: number; revisados: number }>();
  for (const item of all) {
    const fila = porRama.get(item.branch) ?? { total: 0, revisados: 0 };
    fila.total += 1;
    if (item.reviewStatus !== "UNREVIEWED") fila.revisados += 1;
    porRama.set(item.branch, fila);
  }
  const ramas = [...porRama.entries()]
    .map(([branch, datos]) => ({ branch, ...datos }))
    .sort((a, b) => b.total - a.total);
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
          <div className="value">{pendientes.length}</div>
          <div className="label">pendientes de revisar</div>
        </div>
        <div className="card">
          <div className="value">{porEstado.REVIEWED ?? 0}</div>
          <div className="label">revisados</div>
        </div>
        <div className="card">
          <div className="value">{porEstado.MODIFIED ?? 0}</div>
          <div className="label">revisados y modificados</div>
        </div>
        <div className="card">
          <div className="value">{porEstado.REJECTED ?? 0}</div>
          <div className="label">rechazados</div>
        </div>
      </div>

      {siguiente && (
        <p style={{ marginTop: 18 }}>
          <Link href={`/cases/${siguiente.id}`}>
            <button type="button">Siguiente a revisar: {siguiente.id} →</button>
          </Link>
          <span className="small muted" style={{ marginLeft: 10 }}>
            en la ficha puedes guardar y pulsar <strong>N</strong> para pasar al siguiente
          </span>
        </p>
      )}

      <div className="section">
        <h2>Progreso de revisión por rama</h2>
        <table>
          <thead>
            <tr>
              <th>Rama</th>
              <th>Revisados</th>
              <th>De totales</th>
              <th style={{ width: 180 }}>Progreso</th>
            </tr>
          </thead>
          <tbody>
            {ramas.map((rama) => (
              <tr key={rama.branch}>
                <td className="small">{label(BRANCH, rama.branch)}</td>
                <td>
                  <span className={`badge ${rama.revisados === rama.total ? "ok" : "warn"}`}>
                    {rama.revisados}/{rama.total}
                  </span>
                </td>
                <td className="small">{rama.total}</td>
                <td>
                  <Bar value={rama.revisados} max={rama.total} tone={rama.revisados === rama.total ? "ok" : "accent"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
          <option value="UNREVIEWED">Sin revisar ({pendientes.length})</option>
          <option value="REVIEWED">Revisados ({porEstado.REVIEWED ?? 0})</option>
          <option value="MODIFIED">Revisados y modificados ({porEstado.MODIFIED ?? 0})</option>
          <option value="REJECTED">Rechazados ({porEstado.REJECTED ?? 0})</option>
          <option value="TODOS">Todos ({all.length})</option>
        </select>
        <button type="submit">Ver</button>
      </form>

      <ReviewTable
        rows={filtered.map((item) => ({
          id: item.id,
          headline: item.headline,
          branch: item.branch,
          outcome: item.outcome,
          reviewStatus: item.reviewStatus,
        }))}
      />

      {filtered.length === 0 && <p className="muted">No hay casos con ese estado.</p>}
    </>
  );
}
