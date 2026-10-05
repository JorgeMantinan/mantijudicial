import Link from "next/link";
import { canViewCase, requireActor , contextoVisibilidad } from "@/lib/auth";
import { getClientes, listCases } from "@/lib/dataset";
import { OUTCOME, label } from "@/lib/labels";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

type Casos = Awaited<ReturnType<typeof listCases>>;

function resumen(lista: Casos): Record<string, number> {
  const out: Record<string, number> = {};
  for (const caso of lista) out[caso.outcome] = (out[caso.outcome] ?? 0) + 1;
  return out;
}

export default async function CompararClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { actor, orgId, grants } = await contextoVisibilidad();
  const sp = await searchParams;
  const [clientes, todos] = await Promise.all([getClientes(), listCases()]);
  const casos = todos.filter((caso) => canViewCase(actor, caso.id, orgId, grants));

  const agrupados = new Map<string, Casos>();
  for (const caso of casos) {
    const cliente = clientes[caso.id];
    if (!cliente) continue;
    agrupados.set(cliente, [...(agrupados.get(cliente) ?? []), caso]);
  }
  const nombres = [...agrupados.keys()].sort((a, b) => a.localeCompare(b, "es"));
  const a = sp.a && agrupados.has(sp.a) ? sp.a : (nombres[0] ?? "");
  const b = sp.b && agrupados.has(sp.b) && sp.b !== a ? sp.b : (nombres.find((nombre) => nombre !== a) ?? "");
  const listaA = agrupados.get(a) ?? [];
  const listaB = agrupados.get(b) ?? [];

  const revisadosDe = (lista: Casos) => lista.filter((caso) => caso.reviewStatus !== "UNREVIEWED").length;
  const ultimoDe = (lista: Casos) =>
    lista.map((caso) => caso.generatedAt.slice(0, 10)).filter(Boolean).sort().pop() ?? "";

  const metricas: Array<{ nombre: string; ra: string; rb: string }> = [
    { nombre: "Casos", ra: String(listaA.length), rb: String(listaB.length) },
    { nombre: "Revisados", ra: String(revisadosDe(listaA)), rb: String(revisadosDe(listaB)) },
    {
      nombre: "Pendientes",
      ra: String(listaA.length - revisadosDe(listaA)),
      rb: String(listaB.length - revisadosDe(listaB)),
    },
    { nombre: "Último analizado", ra: ultimoDe(listaA) || "—", rb: ultimoDe(listaB) || "—" },
  ];
  for (const outcome of ["ESTIMED", "DISMISSED", "PARTIALLY_ESTIMATED"]) {
    metricas.push({
      nombre: label(OUTCOME, outcome),
      ra: String(resumen(listaA)[outcome] ?? 0),
      rb: String(resumen(listaB)[outcome] ?? 0),
    });
  }

  return (
    <>
      <p className="small muted no-print">
        <Link href="/clientes">← Clientes</Link>
      </p>
      <PrintButton text="Imprimir la comparación" />

      <h1>Comparar dos clientes</h1>
      <p className="lead">
        Sitúa lado a lado dos encargos o clientes para ver volumen, estado de revisión y resultados.
      </p>

      <form className="filters no-print" action="/clientes/comparar" method="get">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Cliente A
          <select name="a" defaultValue={a}>
            {nombres.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Cliente B
          <select name="b" defaultValue={b}>
            {nombres.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ marginTop: 18 }}>
          Comparar
        </button>
      </form>

      {a && b && (
        <>
          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                <th style={{ textAlign: "right" }}>{a}</th>
                <th style={{ textAlign: "right" }}>{b}</th>
              </tr>
            </thead>
            <tbody>
              {metricas.map((fila) => (
                <tr key={fila.nombre}>
                  <td className="small">{fila.nombre}</td>
                  <td style={{ textAlign: "right" }}>{fila.ra}</td>
                  <td style={{ textAlign: "right" }}>{fila.rb}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section">
            <h2>Casos de {a}</h2>
            <ul className="small">
              {listaA.map((caso) => (
                <li key={caso.id}>
                  <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="section">
            <h2>Casos de {b}</h2>
            <ul className="small">
              {listaB.map((caso) => (
                <li key={caso.id}>
                  <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
