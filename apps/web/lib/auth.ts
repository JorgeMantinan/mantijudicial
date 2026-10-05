import path from "node:path";
import { readFileSync } from "node:fs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { can, type Actor, type Grant, type Resource } from "@pipeline/authorization";
import { IdentityStore } from "@pipeline/identity";
import { repoRoot } from "./dataset";

export const SESSION_COOKIE = "mj_session";

export function identityPath(): string {
  return path.join(repoRoot(), "data", "identity.json");
}

export async function loadIdentity(): Promise<IdentityStore> {
  return IdentityStore.load(identityPath());
}

export async function getActor(): Promise<Actor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const identity = await loadIdentity();
  const session = identity.getSession(token);
  if (!session) return null;
  return identity.actorFor(session);
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}

/**
 * El corpus local pertenece al despacho por defecto (el primero del almacén).
 * Sin despacho no hay acceso: deny by default.
 */
export async function defaultOrgId(): Promise<string | null> {
  const identity = await loadIdentity();
  return identity.listFirms()[0]?.id ?? null;
}

export function caseResource(caseId: string, orgId: string | null): Resource {
  return {
    id: caseId,
    kind: "case",
    ownerUserId: null,
    ownerOrgId: orgId,
    visibility: "ORGANIZATION_PRIVATE",
    privacy: "CLIENT_CONFIDENTIAL",
  };
}

/**
 * Dueño real del caso (data/casos_org.json, escrito al subirlo). Síncrono a
 * propósito: `canViewCase` se usa decenas de veces por render. Si el caso no
 * está registrado (corpus antiguo), devuelve null y se usa el org heredado.
 */
let casosOrgCache: { at: number; data: Record<string, string> } | null = null;
function orgDelCasoSync(caseId: string): string | null {
  try {
    if (!casosOrgCache || Date.now() - casosOrgCache.at > 5_000) {
      const ruta = path.join(repoRoot(), "data", "casos_org.json");
      casosOrgCache = { at: Date.now(), data: JSON.parse(readFileSync(ruta, "utf8")) };
    }
    return casosOrgCache.data[caseId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Recurso de caso con el dueño real (data/cosos_org.json) resuelto. Las APIs
 * deben usarlo en lugar de `caseResource(id, defaultOrgId())`: el primer
 * despacho no es el dueño de todo.
 */
export async function recursoCaso(caseId: string): Promise<Resource> {
  const dueno = orgDelCasoSync(caseId) ?? (await defaultOrgId());
  return caseResource(caseId, dueno);
}

export function canViewCase(
  actor: Actor,
  caseId: string,
  orgId: string | null,
  grants: Grant[] = [],
): boolean {
  if (!caseId.startsWith("case_")) return false;
  // El dueño es el despacho que subió el caso; nunca el "primer despacho"
  // por defecto. Sin registro, se respeta el org heredado (corpus antiguo).
  const dueno = orgDelCasoSync(caseId) ?? orgId;
  if (!dueno) return false;
  return can(actor, "VIEW", caseResource(caseId, dueno), grants);
}

export function assertCanViewCase(actor: Actor, caseId: string, orgId: string | null): void {
  if (!canViewCase(actor, caseId, orgId)) redirect("/cases");
}
