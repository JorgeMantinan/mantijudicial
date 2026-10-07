import { leerJson } from "@/lib/api-body";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { can, canCreateCase } from "@pipeline/authorization";
import { defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { isArchived, setArchived } from "@/lib/dataset";
import { auditPath, loadGrantStore } from "@/lib/grants";

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
    body = await leerJson(request);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "Caso no válido" }, { status: 400 });
  }
  const orgId = await defaultOrgId();
  const grants = (await loadGrantStore()).toAuthorizationGrants();
  const recurso = await recursoCaso(caseId);
  // VIEW no basta: un grant de lectura cross-despacho no puede archivar.
  // Escritura solo del despacho dueño (ownerOrgId con el mismo fallback a
  // defaultOrgId que canViewCase) o de quien tenga EDIT explícito.
  const dueno = recurso.ownerOrgId !== null && recurso.ownerOrgId === actor.orgId;
  if (!can(actor, "VIEW", recurso, grants) || (!dueno && !can(actor, "EDIT", recurso, grants))) {
    return NextResponse.json({ error: "No puedes modificar ese caso" }, { status: 403 });
  }
  const archived = body.archived !== false;

  await setArchived(caseId, archived);
  await appendAudit(auditPath(), {
    actor: actor.userId,
    action: archived ? "case.archived" : "case.restored",
    resource: caseId,
    details: { archived },
  });
  return NextResponse.json({ ok: true, caseId, archived, antes: await isArchived(caseId) });
}
