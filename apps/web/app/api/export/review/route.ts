import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { diasSinTocar, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV de la lista de revisión con los mismos filtros que /review. */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "UNREVIEWED";

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

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="revision_${status}.csv"`,
    },
  });
}
