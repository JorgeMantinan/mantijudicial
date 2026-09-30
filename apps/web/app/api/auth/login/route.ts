import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, identityPath, loadIdentity } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Correo y contraseña obligatorios" }, { status: 400 });
  }

  const identity = await loadIdentity();
  const user = identity.authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
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
