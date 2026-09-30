export type Role = "PLATFORM_ADMIN" | "ORG_ADMIN" | "LAWYER" | "PARALEGAL" | "VIEWER";

export type Action = "VIEW" | "EDIT" | "DOWNLOAD" | "SHARE" | "ANALYZE" | "DELETE" | "EXPORT" | "CREATE";

export type Visibility = "GLOBAL_PUBLIC" | "ORGANIZATION_PRIVATE" | "LAWYER_PRIVATE";

export type Privacy =
  | "PUBLIC"
  | "CLIENT_CONFIDENTIAL"
  | "FIRM_CONFIDENTIAL"
  | "LAWYER_ONLY"
  | "RESTRICTED";

export interface Actor {
  userId: string;
  orgId: string;
  role: Role;
  orgIds: string[];
}

export interface Resource {
  id: string;
  kind: "case" | "document" | "knowledge";
  ownerUserId: string | null;
  ownerOrgId: string | null;
  visibility: Visibility;
  privacy: Privacy;
}

export interface Grant {
  resourceId: string;
  granteeUserId: string | null;
  granteeOrgId: string | null;
  actions: Action[];
  grantedBy: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

export class AuthorizationError extends Error {
  readonly resourceId: string;
  readonly action: Action;

  constructor(resourceId: string, action: Action) {
    super(`Acceso denegado: ${action} sobre ${resourceId}`);
    this.name = "AuthorizationError";
    this.resourceId = resourceId;
    this.action = action;
  }
}

const ROLE_ACTIONS: Record<Role, Action[]> = {
  PLATFORM_ADMIN: [],
  ORG_ADMIN: ["VIEW", "EDIT", "DOWNLOAD", "SHARE", "ANALYZE", "DELETE", "EXPORT", "CREATE"],
  LAWYER: ["VIEW", "DOWNLOAD", "ANALYZE", "CREATE"],
  PARALEGAL: ["VIEW", "ANALYZE"],
  VIEWER: ["VIEW"],
};

const PUBLIC_ACTIONS: Action[] = ["VIEW", "ANALYZE", "DOWNLOAD"];

function isActive(grant: Grant, now: Date): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && Date.parse(grant.expiresAt) <= now.getTime()) return false;
  return true;
}

function grantAllows(grant: Grant, actor: Actor, action: Action, now: Date): boolean {
  if (!isActive(grant, now)) return false;
  const forUser = grant.granteeUserId !== null && grant.granteeUserId === actor.userId;
  const forOrg =
    grant.granteeOrgId !== null &&
    grant.granteeOrgId === actor.orgId &&
    actor.orgIds.includes(grant.granteeOrgId);
  if (!forUser && !forOrg) return false;
  return grant.actions.includes(action);
}

/**
 * Deny by default. Ningún acceso se concede por pertenencia, por conocer el
 * id o por tener la URL: solo por propiedad, visibilidad, rol en la
 * organización propietaria o una concesión explícita vigente.
 */
export function can(
  actor: Actor,
  action: Action,
  resource: Resource,
  grants: Grant[],
  now = new Date(),
): boolean {
  if (resource.visibility === "GLOBAL_PUBLIC") {
    return PUBLIC_ACTIONS.includes(action);
  }

  const isOwner = resource.ownerUserId !== null && resource.ownerUserId === actor.userId;
  if (isOwner) return true;

  const sameOrg = resource.ownerOrgId !== null && resource.ownerOrgId === actor.orgId;
  if (resource.visibility === "ORGANIZATION_PRIVATE" && sameOrg) {
    return ROLE_ACTIONS[actor.role].includes(action);
  }

  for (const grant of grants) {
    if (grant.resourceId !== resource.id) continue;
    if (grantAllows(grant, actor, action, now)) return true;
  }

  return false;
}

export function assertCan(
  actor: Actor,
  action: Action,
  resource: Resource,
  grants: Grant[],
  now = new Date(),
): void {
  if (!can(actor, action, resource, grants, now)) {
    throw new AuthorizationError(resource.id, action);
  }
}

/** Crear casos no depende de un recurso previo: solo del rol en su organización. */
export function canCreateCase(actor: Actor): boolean {
  return ROLE_ACTIONS[actor.role].includes("CREATE");
}

/**
 * Compartir: el propietario siempre; en recursos del despacho, también su
 * administración. Lo privado de un abogado no lo comparte nadie más (ni siquiera
 * el FIRM_ADMIN) y el conocimiento público no se comparte porque ya lo es todo.
 */
export function canShareResource(actor: Actor, resource: Resource): boolean {
  if (resource.visibility === "GLOBAL_PUBLIC") return false;
  const isOwner = resource.ownerUserId !== null && resource.ownerUserId === actor.userId;
  if (isOwner) return true;
  if (resource.visibility === "LAWYER_PRIVATE") return false;
  const sameOrg = resource.ownerOrgId !== null && resource.ownerOrgId === actor.orgId;
  return sameOrg && actor.role === "ORG_ADMIN";
}

export function filterVisible<T extends { id: string }>(
  actor: Actor,
  resources: T[],
  describe: (id: string) => Resource | undefined,
  grants: Grant[],
  action: Action = "VIEW",
  now = new Date(),
): T[] {
  return resources.filter((item) => {
    const resource = describe(item.id);
    if (!resource) return false;
    return can(actor, action, resource, grants, now);
  });
}

export function authorizedForRetrieval(
  actor: Actor,
  resources: Resource[],
  grants: Grant[],
  now = new Date(),
): Resource[] {
  return resources.filter((resource) => can(actor, "ANALYZE", resource, grants, now));
}
