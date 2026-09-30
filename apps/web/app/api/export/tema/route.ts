import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { getTema } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV con las sentencias de un tema (mismos filtros que la ficha). */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const topic = url.searchParams.get("tema") ?? "";
  if (!topic) return NextResponse.json({ error: "Falta el tema" }, { status: 400 });

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const ficha = await getTema(topic, (caseId) => canViewCase(actor, caseId, orgId, grants));
  if (!ficha) return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });

  const filas: string[] = [["fecha", "caso", "asunto", "resultado", "frase", "doctrina"].join(";")];
  for (const entry of ficha.tema.entries) {
    filas.push(
      [entry.fecha.slice(0, 10), entry.caseId, entry.headline, entry.outcome, entry.frase, entry.doctrine]
        .map(csv)
        .join(";"),
    );
  }

  const nombre = topic.replace(/[^\wÁÉÍÓÚÑáéíóúñ -]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="tema_${nombre || "sin_nombre"}.csv"`,
    },
  });
}
