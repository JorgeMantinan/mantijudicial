import { leerJson } from "@/lib/api-body";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { RateLimiter, ipDe } from "@pipeline/rate_limit";
import { auditPath } from "@/lib/grants";
import { conLock } from "@/lib/lock";
import { getActor, identityPath, loadIdentity } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mfaLimiter = new RateLimiter({ maxIntentos: 10, ventanaMs: 15 * 60_000 });

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
    body = await leerJson(request);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const action = typeof body.action === "string" ? body.action : "status";
  const code = typeof body.code === "string" ? body.code.trim() : "";

  const claveMfa = `mfa:${ipDe(request)}:${actor.userId}`;
  if (
    (action === "verify" || action === "disable" || action === "setup") &&
    !mfaLimiter.intentar(claveMfa)
  ) {
    return NextResponse.json(
      { error: `Demasiados intentos. Vuelve a probar en ${mfaLimiter.espera(claveMfa)} s` },
      { status: 429 },
    );
  }

  try {
    if (action === "status") {
      const soloLectura = await loadIdentity();
      return NextResponse.json({ enabled: soloLectura.mfaEnabled(actor.userId) });
    }

    // Cada mutación va con load→mutate→save dentro de la cadena: sin ella,
    // dos peticiones simultáneas se comen el cambio la una a la otra.
    if (action === "setup") {
      const { secret, uri } = await conLock(identityPath(), async () => {
        const identity = await loadIdentity();
        const datos = identity.setupMfa(actor.userId);
        await identity.save(identityPath());
        return datos;
      });
      mfaLimiter.liberar(claveMfa);
      return NextResponse.json({ secret, uri, enabled: false });
    }

    if (action === "verify") {
      const ok = await conLock(identityPath(), async () => {
        const identity = await loadIdentity();
        if (!identity.confirmMfa(actor.userId, code)) return false;
        await identity.save(identityPath());
        return true;
      });
      if (!ok) return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
      mfaLimiter.liberar(claveMfa);
      await appendAudit(auditPath(), {
        actor: actor.userId,
        action: "user.mfa_enabled",
        resource: actor.userId,
        details: {},
      });
      return NextResponse.json({ ok: true, enabled: true });
    }

    if (action === "disable") {
      const ok = await conLock(identityPath(), async () => {
        const identity = await loadIdentity();
        if (!identity.disableMfa(actor.userId, code)) return false;
        await identity.save(identityPath());
        return true;
      });
      if (!ok) return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
      mfaLimiter.liberar(claveMfa);
      await appendAudit(auditPath(), {
        actor: actor.userId,
        action: "user.mfa_disabled",
        resource: actor.userId,
        details: {},
      });
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
