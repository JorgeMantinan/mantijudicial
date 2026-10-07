import { leerJson } from "@/lib/api-body";
import { NextResponse, type NextRequest } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { RateLimiter, ipDe } from "@pipeline/rate_limit";
import { auditPath } from "@/lib/grants";
import { conLock } from "@/lib/lock";
import { SESSION_COOKIE, identityPath, loadIdentity } from "@/lib/auth";

const loginLimiter = new RateLimiter({ maxIntentos: 5, ventanaMs: 15 * 60_000 });
// Barrido de cuentas: probando correos distintos nunca se llega al límite
// por correo, así que además hay un tope global por IP. No se libera con un
// acierto: usar una cuenta propia no debe saltarse el corte.
const ipLimiter = new RateLimiter({ maxIntentos: 30, ventanaMs: 15 * 60_000 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown; code?: unknown };
  try {
    body = (await leerJson(request)) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const code = typeof body.code === "string" ? body.code.trim() : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña obligatorios" }, { status: 400 });
  }

  const ip = ipDe(request);
  const clave = `login:${ip}:${email.toLowerCase()}`;
  const claveIp = `login-ip:${ip}`;
  // Bloqueo real: pasado el límite NO se comprueba la contraseña (antes se
  // comprobaba siempre y el límite solo cambiaba el mensaje de error, así la
  // fuerza bruta seguía probando claves; además un acierto relevaba el corte).
  if (!ipLimiter.intentar(claveIp)) {
    return NextResponse.json(
      { error: `Demasiados intentos desde esta IP. Vuelve a probar en ${ipLimiter.espera(claveIp)} s` },
      { status: 429 },
    );
  }
  const permitido = loginLimiter.intentar(clave);
  if (!permitido) {
    return NextResponse.json(
      { error: `Demasiados intentos. Vuelve a probar en ${loginLimiter.espera(clave)} s` },
      { status: 429 },
    );
  }

  // load→mutate→save dentro de la cadena: sin ella, dos logins simultáneos
  // se comen la sesión el uno al otro. Aquí también se podan las sesiones
  // caducadas (C7) antes de abrir la nueva.
  const resultado = await conLock(identityPath(), async () => {
    const identity = await loadIdentity();
    const user = identity.authenticate(email, password);
    if (!user) return { estado: "credenciales" as const };

    const mfa = identity.mfaEnabled(user.id);
    if (mfa && !identity.checkMfa(user.id, code)) {
      return { estado: "doble factor" as const, user };
    }

    const membership = identity.listMemberships(user.id)[0];
    if (!membership) return { estado: "sin despacho" as const, user };

    identity.pruneSessions();
    const session = identity.createSession(user.id, membership.firmId);
    await identity.save(identityPath());
    return { estado: "ok" as const, user, membership, session, mfa };
  });

  if (resultado.estado === "credenciales") {
    await appendAudit(auditPath(), {
      actor: email,
      action: "auth.login_failed",
      resource: email,
      details: { reason: "credenciales" },
    });
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  if (resultado.estado === "doble factor") {
    await appendAudit(auditPath(), {
      actor: resultado.user.id,
      action: "auth.login_failed",
      resource: resultado.user.email,
      details: { reason: "doble factor" },
    });
    return NextResponse.json(
      { error: "Se requiere el código de doble factor", mfaRequired: true },
      { status: 401 },
    );
  }

  if (resultado.estado === "sin despacho") {
    return NextResponse.json(
      { error: "El usuario no pertenece a ningún despacho" },
      { status: 403 },
    );
  }

  loginLimiter.liberar(clave);
  await appendAudit(auditPath(), {
    actor: resultado.user.id,
    action: "auth.login",
    resource: resultado.user.email,
    details: { mfa: resultado.mfa },
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      email: resultado.user.email,
      name: resultado.user.name,
      role: resultado.membership.role,
    },
  });
  response.cookies.set(SESSION_COOKIE, resultado.session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
