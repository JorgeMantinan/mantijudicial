import { NextResponse } from "next/server";
import { defaultOrgId, filtrarCasos, getActor } from "@/lib/auth";
import { getClientes } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { csv , csvResponse } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const casos = await filtrarCasos(actor, orgId, grants, {
    branch,
    outcome,
    q,
    archivados,
    cliente,
  });

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

  return csvResponse(`casos.csv`, filas);
}
