import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { getEvolucion } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

import { csv } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV de la cronología de evolución con los filtros indicados. */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const branch = url.searchParams.get("branch") ?? "";
  const outcome = url.searchParams.get("outcome") ?? "";
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  const enRango = (fecha: string): boolean => {
    const dia = fecha.slice(0, 10);
    return (!desde || dia >= desde) && (!hasta || dia <= hasta);
  };

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const temas = await getEvolucion();

  const filas: string[] = [["fecha", "tema", "caso", "asunto", "resultado", "frase"].join(";")];
  for (const tema of temas) {
    for (const entry of tema.entries) {
      if (!canViewCase(actor, entry.caseId, orgId, grants)) continue;
      if (branch && entry.branch !== branch) continue;
      if (outcome && entry.outcome !== outcome) continue;
      if (!enRango(entry.fecha)) continue;
      filas.push(
        [
          entry.fecha.slice(0, 10),
          tema.topic,
          entry.caseId,
          entry.headline,
          entry.outcome,
          entry.frase,
        ]
          .map(csv)
          .join(";"),
      );
    }
  }

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="evolucion.csv"`,
    },
  });
}
