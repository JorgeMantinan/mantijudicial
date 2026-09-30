import path from "node:path";
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

export function canViewCase(
  actor: Actor,
  caseId: string,
  orgId: string | null,
  grants: Grant[] = [],
): boolean {
  if (!orgId || !caseId.startsWith("case_")) return false;
  return can(actor, "VIEW", caseResource(caseId, orgId), grants);
}

export function assertCanViewCase(actor: Actor, caseId: string, orgId: string | null): void {
  if (!canViewCase(actor, caseId, orgId)) redirect("/cases");
}
