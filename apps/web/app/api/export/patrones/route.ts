import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { getContradicciones, getExitoArgumentos, getGruposFrases } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV con los tres bloques de /patterns (éxito, frases y criterio dividido). */
export async function GET(): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const [exito, grupos, contradictorio] = await Promise.all([
    getExitoArgumentos(),
    getGruposFrases(),
    getContradicciones(),
  ]);

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
  for (const grupo of grupos) {
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

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="patrones.csv"`,
    },
  });
}
