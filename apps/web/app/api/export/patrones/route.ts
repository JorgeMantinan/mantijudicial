import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import {
  filtrarFrasesDelTema,
  getContradicciones,
  getExitoArgumentos,
  getGruposFrases,
  listCases,
} from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { csv , csvResponse } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** CSV con los tres bloques de /patterns (éxito, frases y criterio dividido),
 * acotado a los casos que el despacho del actor puede ver. */
export async function GET(): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const permitido = (caseId: string) => canViewCase(actor, caseId, orgId, grants);
  const visibles = new Set(
    (await listCases())
      .filter((item) => permitido(item.id))
      .map((item) => item.id),
  );

  const [exito, grupos, contradictorio] = await Promise.all([
    getExitoArgumentos([...visibles]),
    getGruposFrases(),
    getContradicciones(3, permitido),
  ]);
  const frases = filtrarFrasesDelTema(grupos, visibles, 50);

  const filas: string[] = [["seccion", "clave", "valor", "detalle"].join(";")];
  for (const fila of exito) {
    filas.push(
      [
        "exito_argumento",
        `${fila.tipo}|${fila.lado}`,
        `${fila.exito}%`,
        `aceptados=${fila.aceptados} rechazados=${fila.rechazados} parciales=${fila.parciales} total=${fila.total}`,
      ]
        .map(csv)
        .join(";"),
    );
  }
  for (const grupo of frases) {
    const instancias = grupo.instancias
      .map((i) => `${i.instancia}:D${i.demandante}/M${i.demandado}/P${i.parcial}`)
      .join(" ");
    filas.push(
      [
        `frase_${grupo.origen.toLowerCase()}`,
        grupo.ejemplo,
        `${grupo.total} casos`,
        `${grupo.homogenea}% igual · ${JSON.stringify(grupo.distribucion)}${instancias ? ` · ${instancias}` : ""}`,
      ]
        .map(csv)
        .join(";"),
    );
  }
  for (const tema of contradictorio) {
    filas.push(
      [
        "criterio_dividido",
        tema.topic,
        `${tema.estimados} estimados/${tema.desestimados} desestimados`,
        `${tema.cases} casos`,
      ]
        .map(csv)
        .join(";"),
    );
  }

  return csvResponse(`patrones.csv`, filas);
}
