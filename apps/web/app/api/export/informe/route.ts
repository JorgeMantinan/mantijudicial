import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { getInforme } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { csv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validar(valor: string | null, fallback: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : fallback;
}

export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = validar(url.searchParams.get("desde"), `${hoy.slice(0, 4)}-01-01`);
  const hasta = validar(url.searchParams.get("hasta"), hoy);

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const informe = await getInforme(
    desde,
    hasta,
    (caseId) => canViewCase(actor, caseId, orgId, grants),
    {
      branch: url.searchParams.get("branch") ?? undefined,
      outcome: url.searchParams.get("outcome") ?? undefined,
    },
  );

  const filas: string[] = [
    ["fecha", "caso", "asunto", "rama", "resultado", "revision"].join(";"),
  ];
  for (const caso of informe.casos) {
    filas.push(
      [caso.fecha, caso.id, caso.headline, caso.branch, caso.outcome, caso.reviewStatus]
        .map(csv)
        .join(";"),
    );
  }

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="informe_${desde}_${hasta}.csv"`,
    },
  });
}
