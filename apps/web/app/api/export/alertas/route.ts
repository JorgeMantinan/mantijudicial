import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { getCalidadCorpus, getContradicciones, getReviewStats, getVigenciaAlerts, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { csv , csvResponse } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV con todas las alertas visibles para el actor. */
export async function GET(): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);

  const [vigencia, contradictorio, calidad, stats, casos] = await Promise.all([
    getVigenciaAlerts(),
    getContradicciones(),
    getCalidadCorpus(),
    getReviewStats(),
    listCases(),
  ]);
  const titulos = new Map(casos.map((item) => [item.id, item.headline]));

  const filas: string[] = [["tipo", "clave", "detalle", "casos"].join(";")];

  for (const alerta of vigencia) {
    const visibles = alerta.casos.filter((caso) => puedeVer(caso.caseId));
    if (visibles.length === 0) continue;
    filas.push(
      [
        "ley_cambiada",
        `${alerta.norma} ${alerta.titulo}`,
        `vigente desde ${alerta.version_actual}; en la sentencia: ${visibles[0]?.version_en_sentencia ?? "—"}`,
        visibles.map((caso) => caso.caseId).join(" "),
      ]
        .map(csv)
        .join(";"),
    );
  }

  for (const tema of contradictorio) {
    const ejemplos = tema.ejemplos.filter((ejemplo) => puedeVer(ejemplo.caseId));
    if (ejemplos.length === 0) continue;
    filas.push(
      [
        "tema_dividido",
        tema.topic,
        `${tema.estimados} estimados / ${tema.desestimados} desestimados`,
        ejemplos.map((ejemplo) => ejemplo.caseId).join(" "),
      ]
        .map(csv)
        .join(";"),
    );
  }

  for (const id of calidad.stale.filter(puedeVer)) {
    filas.push(["pdf_stale", id, "el PDF es más nuevo que el análisis", id].map(csv).join(";"));
  }
  for (const id of calidad.escaneados.filter(puedeVer)) {
    filas.push(["pdf_sin_texto", id, "sin texto extraíble", id].map(csv).join(";"));
  }
  for (const item of stats.pending.filter((pendiente) => puedeVer(pendiente.id))) {
    filas.push(
      ["sin_revisar", item.id, titulos.get(item.id) ?? item.headline, item.id].map(csv).join(";"),
    );
  }

  return csvResponse(`alertas.csv`, filas);
}
