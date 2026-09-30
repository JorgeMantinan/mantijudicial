import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
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

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const casos = (
    await listCases({ branch, outcome, q })
  )
    .filter((item) => canViewCase(actor, item.id, orgId, grants))
    .filter((item) => (archivados ? true : !item.archived));

  const filas: string[] = [
    ["caso", "asunto", "rama", "resultado", "recurrente", "revisado", "enriquecido"].join(";"),
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
