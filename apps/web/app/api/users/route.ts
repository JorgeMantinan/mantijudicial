import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import type { Role } from "@pipeline/authorization";
import { IdentityError } from "@pipeline/identity";
import { auditPath } from "@/lib/grants";
import { getActor, identityPath, loadIdentity } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["ORG_ADMIN", "LAWYER", "PARALEGAL", "VIEWER"];

async function requireOrgAdmin(): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (actor.role !== "ORG_ADMIN") {
    return NextResponse.json({ error: "Solo la administración del despacho" }, { status: 403 });
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  const denied = await requireOrgAdmin();
  if (denied) return denied;

  const actor = (await getActor())!;
  const orgIds = new Set(actor.orgIds);
  const identity = await loadIdentity();
  const firms = new Map(identity.listFirms().map((firm) => [firm.id, firm.name]));
  const users = identity.listUsers()
    .map((user) => ({
      base: user,
      membership: identity.listMemberships(user.id).find((m) => orgIds.has(m.firmId)),
    }))
    .filter((row) => Boolean(row.membership))
    .map((row) => ({
      id: row.base.id,
      email: row.base.email,
      name: row.base.name,
      role: row.membership?.role ?? "—",
      firm: row.membership ? (firms.get(row.membership.firmId) ?? row.membership.firmId) : "—",
      created_at: row.base.created_at,
    }));
  return NextResponse.json({ users });
}

export async function POST(request: Request): Promise<NextResponse> {
  const denied = await requireOrgAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const roleRaw = typeof body.role === "string" ? body.role : "LAWYER";
  if (!(ROLES as string[]).includes(roleRaw)) {
    return NextResponse.json({ error: `Rol no válido: ${roleRaw}` }, { status: 400 });
  }
  const role = roleRaw as Role;

  const identity = await loadIdentity();
  const actor = await getActor();
  const firmId =
    typeof body.firmId === "string" && body.firmId
      ? body.firmId
      : (actor ? identity.listMemberships(actor.userId)[0]?.firmId : undefined) ??
        identity.listFirms()[0]?.id;
  if (!firmId) {
    return NextResponse.json({ error: "No hay despacho asignado" }, { status: 400 });
  }
  if (!actor || !actor.orgIds.includes(firmId)) {
    return NextResponse.json({ error: "No puedes crear usuarios en ese despacho" }, { status: 403 });
  }

  try {
    const user = identity.registerUser({ email, name, password });
    identity.addMembership(user.id, firmId, role);
    await identity.save(identityPath());
    await appendAudit(auditPath(), {
      actor: actor?.userId ?? "desconocido",
      action: "user.create",
      resource: user.id,
      details: { email: user.email, role, firmId },
    });
    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, role } },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof IdentityError ? error.message : "No se pudo crear el usuario";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
