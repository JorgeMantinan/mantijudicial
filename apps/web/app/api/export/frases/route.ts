import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { filtrarFrasesDelTema, getGruposFrases, getInforme } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function validar(valor: string | null, fallback: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : fallback;
}

/** CSV con las frases homogéneas del periodo repartidas por periodo. */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const hoy = new Date().toISOString().slice(0, 10);
  const desde = validar(url.searchParams.get("desde"), `${hoy.slice(0, 4)}-01-01`);
  const hasta = validar(url.searchParams.get("hasta"), hoy);

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const informe = await getInforme(desde, hasta, (caseId) =>
    canViewCase(actor, caseId, orgId, grants),
  );
  const frases = filtrarFrasesDelTema(
    await getGruposFrases(),
    new Set(informe.casos.map((caso) => caso.id)),
  );
  const fechaPorId = new Map(informe.casos.map((caso) => [caso.id, caso.fecha]));
  const porMes = !informe.periodos[0]?.includes("-T");
  const etiquetaFecha = (fecha: string): string =>
    porMes
      ? fecha.slice(0, 7)
      : `${fecha.slice(0, 4)}-T${Math.ceil(Number(fecha.slice(5, 7)) / 3)}`;

  const filas: string[] = [["frase", "periodo", "n", "estimados", "desestimados", "total_frase"].join(";")];
  for (const grupo of frases) {
    const celdas: Record<string, { n: number; e: number; d: number }> = {};
    for (const caso of grupo.casos) {
      const fecha = fechaPorId.get(caso.caseId);
      if (!fecha) continue;
      const clave = etiquetaFecha(fecha);
      const celda = celdas[clave] ?? { n: 0, e: 0, d: 0 };
      celda.n += 1;
      if (caso.outcome === "ESTIMED") celda.e += 1;
      else if (caso.outcome === "DISMISSED") celda.d += 1;
      celdas[clave] = celda;
    }
    for (const [periodo, celda] of Object.entries(celdas)) {
      filas.push(
        [grupo.ejemplo, periodo, celda.n, celda.e, celda.d, grupo.total]
          .map((valor) => csv(String(valor)))
          .join(";"),
      );
    }
  }

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="frases_periodo_${desde}_${hasta}.csv"`,
    },
  });
}
