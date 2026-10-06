import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getCalidadCorpus, getCostesIA, getEvalReport, getSistemaInfo } from "@/lib/dataset";
import { csv , csvResponse } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filas(objeto: unknown, seccion: string, prefijo = ""): string[] {
  const out: string[] = [];
  if (objeto === null || objeto === undefined) return out;
  if (typeof objeto === "number" || typeof objeto === "string" || typeof objeto === "boolean") {
    out.push([seccion, prefijo || "valor", String(objeto)].map(csv).join(";"));
    return out;
  }
  if (Array.isArray(objeto)) return out;
  for (const [clave, valor] of Object.entries(objeto as Record<string, unknown>)) {
    if (valor === null || valor === undefined) continue;
    if (typeof valor === "object" && !Array.isArray(valor)) {
      out.push(...filas(valor, seccion, prefijo ? `${prefijo}.${clave}` : clave));
    } else if (typeof valor !== "object") {
      out.push([seccion, prefijo ? `${prefijo}.${clave}` : clave, String(valor)].map(csv).join(";"));
    }
  }
  return out;
}

/** CSV con las métricas de /eval (informe, costes, calidad y sistema). */
export async function GET(): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (actor.role !== "ORG_ADMIN") {
    return NextResponse.json({ error: "Solo la administración del despacho" }, { status: 403 });
  }

  const [reporte, costes, calidad, sistema] = await Promise.all([
    getEvalReport(),
    getCostesIA(),
    getCalidadCorpus(),
    getSistemaInfo(),
  ]);

  const filasOut: string[] = [["seccion", "clave", "valor"].join(";")];
  filasOut.push(...filas(reporte, "informe_eval"));
  filasOut.push(
    ...[
      ["costes", "total", costes.total.toFixed(6)],
      ["costes", "enriquecer", costes.enriquecerCoste.toFixed(6)],
      ["costes", "enriquecer_casos", String(costes.enriquecerCasos)],
      ["costes", "vias", costes.viasCoste.toFixed(6)],
      ["costes", "comparaciones", costes.comparacionCoste.toFixed(6)],
      ["costes", "escritos", costes.escritoCoste.toFixed(6)],
      ["calidad", "total", String(calidad.total)],
      ["calidad", "pdf_sin_texto", String(calidad.escaneados.length)],
      ["calidad", "stale", String(calidad.stale.length)],
      ["calidad", "sin_enriquecer", String(calidad.sinEnriquecer.length)],
      ["calidad", "sin_revisar", String(calidad.sinRevisar.length)],
      ["sistema", "version", sistema.version],
      ["sistema", "casos", String(sistema.casos)],
      ["sistema", "normas", String(sistema.normas)],
      ["sistema", "bytes_cases", String(sistema.bytesCases)],
      ["sistema", "bytes_laws", String(sistema.bytesLaws)],
      ["sistema", "ultima_sentencia", sistema.ultimaSentencia ?? ""],
      ["sistema", "ultima_copia", sistema.ultimaCopia ?? ""],
    ].map((fila) => fila.map(csv).join(";")),
  );

  return csvResponse(`eval.csv`, filasOut);
}
