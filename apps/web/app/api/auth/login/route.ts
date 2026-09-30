import { NextResponse, type NextRequest } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { auditPath } from "@/lib/grants";
import { SESSION_COOKIE, identityPath, loadIdentity } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña obligatorios" }, { status: 400 });
  }

  const identity = await loadIdentity();
  const user = identity.authenticate(email, password);
  if (!user) {
    await appendAudit(auditPath(), {
      actor: email,
      action: "auth.login_failed",
      resource: email,
      details: { reason: "credenciales" },
    });
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  if (identity.mfaEnabled(user.id) && !identity.checkMfa(user.id, code)) {
    await appendAudit(auditPath(), {
      actor: user.id,
      action: "auth.login_failed",
      resource: user.email,
      details: { reason: "doble factor" },
    });
    return NextResponse.json(
      { error: "Se requiere el código de doble factor", mfaRequired: true },
      { status: 401 },
    );
  }

  const membership = identity.listMemberships(user.id)[0];
  if (!membership) {
    return NextResponse.json(
      { error: "El usuario no pertenece a ningún despacho" },
      { status: 403 },
    );
  }

  const session = identity.createSession(user.id, membership.firmId);
  await identity.save(identityPath());
  await appendAudit(auditPath(), {
    actor: user.id,
    action: "auth.login",
    resource: user.email,
    details: { mfa: identity.mfaEnabled(user.id) },
  });

  const response = NextResponse.json({
    ok: true,
    user: { email: user.email, name: user.name, role: membership.role },
  });
  response.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
