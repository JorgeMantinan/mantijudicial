import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { can, canShareResource } from "@pipeline/authorization";
import { GrantError, SHAREABLE_ACTIONS } from "@pipeline/grants";
import { auditPath, authorizationGrants, grantsPath, loadGrantStore } from "@/lib/grants";
import { defaultOrgId, getActor, loadIdentity , recursoCaso } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function granteeLabel(grant: {
  granteeUserId: string | null;
  granteeOrgId: string | null;
}): Promise<string> {
  if (grant.granteeOrgId) {
    const firm = (await loadIdentity()).listFirms().find((item) => item.id === grant.granteeOrgId);
    return firm?.name ?? grant.granteeOrgId;
  }
  const user = (await loadIdentity()).listUsers().find((item) => item.id === grant.granteeUserId);
  return user ? `${user.name} <${user.email}>` : (grant.granteeUserId ?? "—");
}

export async function GET(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const resourceId = new URL(request.url).searchParams.get("resource");
  if (!resourceId || !/^case_\d{6}$/.test(resourceId)) {
    return NextResponse.json({ error: "resource no válido" }, { status: 400 });
  }
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  if (!can(actor, "VIEW", await recursoCaso(resourceId), grants)) {
    return NextResponse.json({ error: "No puedes ver este caso" }, { status: 403 });
  }

  const store = await loadGrantStore();
  const items = await Promise.all(
    store.list(resourceId).map(async (grant) => ({
      id: grant.id,
      grantee: await granteeLabel(grant),
      granteeUserId: grant.granteeUserId,
      granteeOrgId: grant.granteeOrgId,
      actions: grant.actions,
      grantedBy: grant.grantedBy,
      createdAt: grant.createdAt,
      expiresAt: grant.expiresAt,
      revokedAt: grant.revokedAt,
    })),
  );
  return NextResponse.json({
    resourceId,
    canShare: canShareResource(actor, await recursoCaso(resourceId)),
    shareableActions: SHAREABLE_ACTIONS,
    grants: items,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  if (!/^case_\d{6}$/.test(resourceId)) {
    return NextResponse.json({ error: "Recurso no válido" }, { status: 400 });
  }

  const orgId = await defaultOrgId();
  if (!canShareResource(actor, await recursoCaso(resourceId))) {
    return NextResponse.json({ error: "No puedes compartir este caso" }, { status: 403 });
  }

  const granteeUserId = typeof body.granteeUserId === "string" ? body.granteeUserId : null;
  const granteeOrgId = typeof body.granteeOrgId === "string" ? body.granteeOrgId : null;
  const actions = Array.isArray(body.actions)
    ? body.actions.filter((item): item is string => typeof item === "string")
    : [];

  try {
    const store = await loadGrantStore();
    const grant = store.grant(
      {
        resourceId,
        granteeUserId,
        granteeOrgId,
        actions,
        grantedBy: actor.userId,
        expiresAt: typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null,
      },
      new Date(),
    );
    await store.save(grantsPath());
    await appendAudit(auditPath(), {
      actor: actor.userId,
      action: "share.grant",
      resource: resourceId,
      details: {
        grantId: grant.id,
        granteeUserId,
        granteeOrgId,
        actions: grant.actions,
        expiresAt: grant.expiresAt,
      },
    });
    return NextResponse.json({ ok: true, grant }, { status: 201 });
  } catch (error) {
    const message = error instanceof GrantError ? error.message : "No se pudo compartir";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
