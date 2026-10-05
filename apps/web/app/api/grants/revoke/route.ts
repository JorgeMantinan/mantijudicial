import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { canShareResource } from "@pipeline/authorization";
import { GrantError } from "@pipeline/grants";
import { auditPath, grantsPath, loadGrantStore } from "@/lib/grants";
import { defaultOrgId, getActor, recursoCaso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const grantId = typeof body.grantId === "string" ? body.grantId : "";
  if (!grantId) return NextResponse.json({ error: "grantId obligatorio" }, { status: 400 });

  try {
    const store = await loadGrantStore();
    const existing = store.list().find((item) => item.id === grantId);
    if (!existing) return NextResponse.json({ error: "Concesión no encontrada" }, { status: 404 });

    const orgId = await defaultOrgId();
    if (!canShareResource(actor, await recursoCaso(existing.resourceId))) {
      return NextResponse.json({ error: "No puedes modificar este caso" }, { status: 403 });
    }

    const grant = store.revoke(grantId, new Date());
    await store.save(grantsPath());
    await appendAudit(auditPath(), {
      actor: actor.userId,
      action: "share.revoke",
      resource: existing.resourceId,
      details: { grantId, granteeUserId: existing.granteeUserId },
    });
    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    const message = error instanceof GrantError ? error.message : "No se pudo revocar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
