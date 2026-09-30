import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { auditPath } from "@/lib/grants";
import { getActor, identityPath, loadIdentity } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gestión del doble factor (TOTP):
 *   { action: "setup" }                → devuelve secreto + URI (queda inactivo)
 *   { action: "verify", code: "123456" } → lo activa
 *   { action: "disable", code: "123456" } → lo desactiva y cierra las sesiones
 *   { action: "status" }                → estado actual
 */
export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "status";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const identity = await loadIdentity();

  try {
    if (action === "status") {
      return NextResponse.json({ enabled: identity.mfaEnabled(actor.userId) });
    }

    if (action === "setup") {
      const { secret, uri } = identity.setupMfa(actor.userId);
      await identity.save(identityPath());
      return NextResponse.json({ secret, uri, enabled: false });
    }

    if (action === "verify") {
      const ok = identity.confirmMfa(actor.userId, code);
      if (!ok) return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
      await identity.save(identityPath());
      await appendAudit(auditPath(), {
        actor: actor.userId,
        action: "user.mfa_enabled",
        resource: actor.userId,
        details: {},
      });
      return NextResponse.json({ ok: true, enabled: true });
    }

    if (action === "disable") {
      const ok = identity.disableMfa(actor.userId, code);
      if (!ok) return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
      await identity.save(identityPath());
      return NextResponse.json({ ok: true, enabled: false });
    }

    return NextResponse.json({ error: `Acción no válida: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error con el doble factor" },
      { status: 400 },
    );
  }
}
