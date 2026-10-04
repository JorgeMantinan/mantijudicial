import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { getClientes, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV de la lista de casos con los mismos filtros que la pantalla /cases. */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const branch = url.searchParams.get("branch") ?? undefined;
  const outcome = url.searchParams.get("outcome") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const archivados = url.searchParams.get("archivados") === "1";
  const cliente = url.searchParams.get("cliente") ?? "";
  const clientesMap = await getClientes();

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const casos = (
    await listCases({ branch, outcome, q })
  )
    .filter((item) => canViewCase(actor, item.id, orgId, grants))
    .filter((item) => (archivados ? true : !item.archived))
    .filter((item) => (cliente ? clientesMap[item.id] === cliente : true));

  const filas: string[] = [
    ["caso", "asunto", "rama", "resultado", "recurrente", "revisado", "enriquecido", "cliente"].join(
      ";",
    ),
  ];
  for (const caso of casos) {
    filas.push(
      [
        caso.id,
        caso.headline,
        caso.branch,
        caso.outcome,
        caso.recurringSide,
        caso.reviewStatus,
        caso.enriched ? "si" : "no",
        clientesMap[caso.id] ?? "",
      ]
        .map(csv)
        .join(";"),
    );
  }

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="casos.csv"`,
    },
  });
}
