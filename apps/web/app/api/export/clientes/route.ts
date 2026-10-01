import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getClientes, listCases } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV del panel de clientes (agregado por cliente/encargo). */
export async function GET(): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [clientes, casos] = await Promise.all([getClientes(), listCases()]);
  const agrupados = new Map<string, typeof casos>();
  const sinAsignar: typeof casos = [];
  for (const caso of casos) {
    const cliente = clientes[caso.id];
    if (!cliente) sinAsignar.push(caso);
    else agrupados.set(cliente, [...(agrupados.get(cliente) ?? []), caso]);
  }

  const filas: string[] = [
    ["cliente", "casos", "revisados", "pendientes", "ultimo_analizado", "resultados"].join(";"),
  ];
  const fila = (nombre: string, lista: typeof casos) => {
    const revisados = lista.filter((caso) => caso.reviewStatus !== "UNREVIEWED").length;
    const ultimo = lista
      .map((caso) => caso.generatedAt.slice(0, 10))
      .filter(Boolean)
      .sort()
      .pop();
    const dist = new Map<string, number>();
    for (const caso of lista) dist.set(caso.outcome, (dist.get(caso.outcome) ?? 0) + 1);
    const resultados = [...dist.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([outcome, cantidad]) => `${outcome}:${cantidad}`)
      .join(" ");
    filas.push(
      [nombre, lista.length, revisados, lista.length - revisados, ultimo ?? "", resultados]
        .map((valor) => csv(String(valor)))
        .join(";"),
    );
  };

  for (const [nombre, lista] of [...agrupados.entries()].sort((a, b) => b[1].length - a[1].length)) {
    fila(nombre, lista);
  }
  if (sinAsignar.length > 0) fila("(sin asignar)", sinAsignar);

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="clientes.csv"`,
    },
  });
}
