import { NextResponse } from "next/server";
import { can } from "@pipeline/authorization";
import { getActor, recursoCaso } from "@/lib/auth";
import { loadGrantStore } from "@/lib/grants";
import { getCase, getVias } from "@/lib/dataset";

export const dynamic = "force-dynamic";

/**
 * Exportación de un caso en JSON para entregarlo o archivarlo.
 * Excluye las notas privadas (LAWYER_ONLY): no salen de la cuenta de su autor.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const caseId = new URL(request.url).searchParams.get("resource");
  if (!caseId || !/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "resource no válido" }, { status: 400 });
  }

  const grants = (await loadGrantStore()).toAuthorizationGrants();
  if (!can(actor, "VIEW", await recursoCaso(caseId), grants)) {
    return NextResponse.json({ error: "No puedes ver este caso" }, { status: 403 });
  }

  const detail = await getCase(caseId);
  if (!detail) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  const vias = await getVias(caseId);

  const payload = {
    exported_at: new Date().toISOString(),
    exported_by: actor.userId,
    notice:
      "Documento generado por MantiJudicial a partir de una sentencia pública y de un análisis " +
      "asistido por IA pendiente de revisión por un abogado.",
    case: {
      id: detail.id,
      headline: detail.headline,
      subtopic: detail.subtopic,
      branch: detail.branch,
      outcome: detail.outcome,
      recurring_side: detail.recurringSide,
      review_status: detail.reviewStatus,
      enriched: detail.enriched,
    },
    resumen: detail.summary,
    resultado: detail.outcomeDetail,
    partes: detail.parties,
    pretensiones: detail.claims,
    hechos: detail.facts,
    cronologia: detail.timeline,
    argumentos: detail.arguments,
    frases_del_tribunal: detail.reasoning,
    cuestiones: detail.issues,
    leyes_citadas: detail.citedLaws,
    leyes_verificadas: detail.lawRefs,
    vias_de_actuacion: vias?.report ?? null,
  };

  return new NextResponse(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${caseId}.json"`,
    },
  });
}
