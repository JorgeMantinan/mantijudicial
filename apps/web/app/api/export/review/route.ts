import { csv, csvResponse } from "@/lib/csv";
import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { diasSinTocar, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV de la lista de revisión con los mismos filtros que /review. */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "UNREVIEWED";
  const statusSeguro = /^(UNREVIEWED|REVIEWED|MODIFIED|REJECTED|TODOS)$/.test(status)
    ? status
    : "listado";

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const casos = (await listCases())
    .filter((item) => canViewCase(actor, item.id, orgId, grants))
    .filter((item) => (status === "TODOS" ? true : item.reviewStatus === status));

  const filas: string[] = [
    ["caso", "asunto", "rama", "resultado", "revision", "sin_tocar_dias"].join(";"),
  ];
  for (const caso of casos) {
    filas.push(
      [caso.id, caso.headline, caso.branch, caso.outcome, caso.reviewStatus, diasSinTocar(caso)]
        .map((valor) => csv(String(valor)))
        .join(";"),
    );
  }

  return csvResponse(`revision_${statusSeguro}.csv`, filas);
}
