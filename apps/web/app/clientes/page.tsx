import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { getClientes, listCases } from "@/lib/dataset";
import { OUTCOME, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  await requireActor();
  const [clientes, casos] = await Promise.all([getClientes(), listCases()]);

  const agrupados = new Map<string, typeof casos>();
  const sinAsignar: typeof casos = [];
  for (const caso of casos) {
    const cliente = clientes[caso.id];
    if (!cliente) {
      sinAsignar.push(caso);
      continue;
    }
    agrupados.set(cliente, [...(agrupados.get(cliente) ?? []), caso]);
  }
  const grupos = [...agrupados.entries()].sort((a, b) => b[1].length - a[1].length);

  const resumen = (lista: typeof casos): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const caso of lista) out[caso.outcome] = (out[caso.outcome] ?? 0) + 1;
    return out;
  };

  return (
    <>
      <h1>Clientes y encargos</h1>
      <p className="lead">
        Los casos agrupados por el cliente/encargo que has asignado en cada ficha. Para cambiarlo,
        abre el caso y usa «Cliente / encargo».
      </p>

      {grupos.length === 0 ? (
        <p className="muted">
          Todavía no has asignado ningún cliente. Hazlo desde la ficha de un caso y aparecerá aquí.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Cliente / encargo</th>
              <th>Casos</th>
              <th>Revisados</th>
              <th>Pendientes</th>
              <th>Resultados</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grupos.map(([cliente, lista]) => {
              const revisados = lista.filter((caso) => caso.reviewStatus !== "UNREVIEWED").length;
              const distribucion = resumen(lista);
              return (
                <tr key={cliente}>
                  <td>
                    <strong>{cliente}</strong>
                  </td>
                  <td>
                    <span className="badge">{lista.length}</span>
                  </td>
                  <td>
                    <span className={`badge ${revisados === lista.length ? "ok" : "warn"}`}>
                      {revisados}/{lista.length}
                    </span>
                  </td>
                  <td className="small">{lista.length - revisados}</td>
                  <td className="small">
                    {Object.entries(distribucion)
                      .sort((a, b) => b[1] - a[1])
                      .map(([outcome, cantidad]) => `${label(OUTCOME, outcome)} ${cantidad}`)
                      .join(" · ")}
                  </td>
                  <td>
                    <Link href={`/cases?cliente=${encodeURIComponent(cliente)}`}>ver casos →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="section">
        <h2>Sin cliente asignado</h2>
        <p className="small">
          {sinAsignar.length} de {casos.length} casos todavía no tienen cliente/encargo.{" "}
          <Link href="/cases">Ver la lista →</Link>
        </p>
      </div>
    </>
  );
}
