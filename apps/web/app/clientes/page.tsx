import Link from "next/link";
import { canViewCase, contextoVisibilidad } from "@/lib/auth";
import { getClientes, listCases } from "@/lib/dataset";
import { OUTCOME, label } from "@/lib/labels";
import { PrintButton } from "@/components/print-button";
import { SortTh } from "@/lib/sort-th";

export const dynamic = "force-dynamic";

type Casos = Awaited<ReturnType<typeof listCases>>;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; q?: string }>;
}) {
  const { actor, orgId, grants } = await contextoVisibilidad();
  const sp = await searchParams;
  const [clientes, todos] = await Promise.all([getClientes(), listCases()]);
  const casos = todos.filter((caso) => canViewCase(actor, caso.id, orgId, grants));

  const agrupados = new Map<string, Casos>();
  const sinAsignar: Casos = [];
  for (const caso of casos) {
    const cliente = clientes[caso.id];
    if (!cliente) {
      sinAsignar.push(caso);
      continue;
    }
    agrupados.set(cliente, [...(agrupados.get(cliente) ?? []), caso]);
  }

  const q = (sp.q ?? "").trim().toLowerCase();
  let grupos = [...agrupados.entries()];
  if (q) grupos = grupos.filter(([cliente]) => cliente.toLowerCase().includes(q));

  const revisadosDe = (lista: Casos) => lista.filter((caso) => caso.reviewStatus !== "UNREVIEWED").length;
  const ultimoDe = (lista: Casos) =>
    lista.map((caso) => caso.generatedAt.slice(0, 10)).filter(Boolean).sort().pop() ?? "";

  const sort = ["cliente", "casos", "revisados", "ultimo"].includes(sp.sort ?? "")
    ? (sp.sort as string)
    : "casos";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const factor = dir === "desc" ? -1 : 1;
  grupos.sort((a, b) => {
    if (sort === "cliente") return a[0].localeCompare(b[0], "es") * factor;
    if (sort === "revisados") return (revisadosDe(a[1]) - revisadosDe(b[1])) * factor;
    if (sort === "ultimo") return ultimoDe(a[1]).localeCompare(ultimoDe(b[1])) * factor;
    return (a[1].length - b[1].length) * factor;
  });

  const resumen = (lista: Casos): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const caso of lista) out[caso.outcome] = (out[caso.outcome] ?? 0) + 1;
    return out;
  };
  const base = { q: sp.q };

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> · <a href="/api/export/clientes">descargar CSV</a> ·{" "}
        <Link href="/clientes/comparar">comparar dos clientes</Link>
      </p>
      <PrintButton text="Imprimir el panel de clientes" />

      <h1>Clientes y encargos</h1>
      <p className="lead">
        Los casos agrupados por el cliente/encargo que has asignado en cada ficha. Para cambiarlo,
        abre el caso y usa «Cliente / encargo».{" "}
        <a href="/api/export/clientes">descargar CSV</a>
      </p>

        <form className="filters no-print" action="/clientes" method="get">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Filtrar por nombre de cliente" />
        <button type="submit">Filtrar</button>
        {q && (
          <Link className="small" href="/clientes">
            limpiar
          </Link>
        )}
      </form>

      {grupos.length === 0 ? (
        <p className="muted">
          {q
            ? "Ningún cliente con ese nombre."
            : "Todavía no has asignado ningún cliente. Hazlo desde la ficha de un caso y aparecerá aquí."}
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <SortTh path="/clientes" sortKey="cliente" current={sort} dir={dir} label="Cliente / encargo" base={base} />
              <SortTh path="/clientes" sortKey="casos" current={sort} dir={dir} label="Casos" base={base} />
              <SortTh path="/clientes" sortKey="revisados" current={sort} dir={dir} label="Revisados" base={base} />
              <th>Pendientes</th>
              <SortTh path="/clientes" sortKey="ultimo" current={sort} dir={dir} label="Último" base={base} />
              <th>Resultados</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {grupos.map(([cliente, lista]) => {
              const revisados = revisadosDe(lista);
              const distribucion = resumen(lista);
              return (
                <tr key={cliente}>
                  <td>
                    <Link href={`/clientes/${encodeURIComponent(cliente)}`}>
                      <strong>{cliente}</strong>
                    </Link>
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
                  <td className="mono small">{ultimoDe(lista) || "—"}</td>
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
    </article>
  );
}
