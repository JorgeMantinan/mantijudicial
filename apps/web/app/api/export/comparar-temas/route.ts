import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { filtrarFrasesDelTema, getGruposFrases, getTema } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { OUTCOME, label } from "@/lib/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(campo: string): string {
  const texto = String(campo ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV de la comparación de dos temas (mismas métricas que la pantalla). */
export async function GET(request: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const url = new URL(request.url);
  const a = url.searchParams.get("a") ?? "";
  const b = url.searchParams.get("b") ?? "";
  if (!a || !b) return NextResponse.json({ error: "Faltan los dos temas" }, { status: 400 });

  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);
  const [fichaA, fichaB] = await Promise.all([getTema(a, puedeVer), getTema(b, puedeVer)]);
  if (!fichaA || !fichaB) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const filas: string[] = [["seccion", "clave", "valor_a", "valor_b"].join(";")];
  const metrica = (clave: string, va: string | number, vb: string | number) =>
    filas.push([clave, "", va, vb].map((valor) => csv(String(valor))).join(";"));

  metrica("casos", fichaA.tema.cases, fichaB.tema.cases);
  metrica("primera_sentencia", fichaA.tema.first.slice(0, 10), fichaB.tema.first.slice(0, 10));
  metrica("ultima_sentencia", fichaA.tema.last.slice(0, 10), fichaB.tema.last.slice(0, 10));
  for (const outcome of ["ESTIMED", "DISMISSED", "PARTIALLY_ESTIMATED"]) {
    metrica(
      label(OUTCOME, outcome),
      fichaA.tema.distribution[outcome] ?? 0,
      fichaB.tema.distribution[outcome] ?? 0,
    );
  }
  const grupos = await getGruposFrases();
  metrica(
    "frases_repetidas",
    filtrarFrasesDelTema(grupos, new Set(fichaA.tema.entries.map((entry) => entry.caseId))).length,
    filtrarFrasesDelTema(grupos, new Set(fichaB.tema.entries.map((entry) => entry.caseId))).length,
  );
  metrica("normas_citadas", fichaA.leyes.length, fichaB.leyes.length);

  for (const [seccion, ficha] of [
    ["casos_A", fichaA],
    ["casos_B", fichaB],
  ] as const) {
    for (const entry of ficha.tema.entries) {
      filas.push(
        [seccion, entry.caseId, entry.fecha.slice(0, 10), entry.outcome]
          .map((valor) => csv(String(valor)))
          .join(";"),
      );
    }
  }

  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="comparar_temas.csv"`,
    },
  });
}
