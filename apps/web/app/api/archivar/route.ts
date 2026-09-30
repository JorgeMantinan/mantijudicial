import { NextResponse } from "next/server";
import { canCreateCase } from "@pipeline/authorization";
import { getActor } from "@/lib/auth";
import { isArchived, setArchived } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Archiva o restaura un caso (lo oculta de la lista; no borra nada). */
export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite archivar casos" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "Caso no válido" }, { status: 400 });
  }
  const archived = body.archived !== false;

  await setArchived(caseId, archived);
  return NextResponse.json({ ok: true, caseId, archived, antes: await isArchived(caseId) });
}
