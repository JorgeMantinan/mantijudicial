import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Action, Grant } from "./authorization.js";

export interface CaseGrant {
  id: string;
  resourceId: string;
  granteeUserId: string | null;
  granteeOrgId: string | null;
  actions: Action[];
  grantedBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export const SHAREABLE_ACTIONS: Action[] = ["VIEW", "DOWNLOAD", "ANALYZE", "EDIT", "SHARE", "EXPORT"];

export class GrantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrantError";
  }
}

export interface GrantInput {
  resourceId: string;
  granteeUserId?: string | null;
  granteeOrgId?: string | null;
  actions: string[];
  grantedBy: string;
  expiresAt?: string | null;
}

export class GrantStore {
  private grants: CaseGrant[];

  private constructor(grants: CaseGrant[]) {
    this.grants = grants;
  }

  static empty(): GrantStore {
    return new GrantStore([]);
  }

  static async load(filePath: string): Promise<GrantStore> {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as { grants?: CaseGrant[] };
      return new GrantStore(Array.isArray(parsed.grants) ? parsed.grants : []);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return GrantStore.empty();
      throw error;
    }
  }

  async save(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify({ grants: this.grants }, null, 2)}\n`, "utf8");
    await fs.rename(tmp, filePath);
  }

  list(resourceId?: string): CaseGrant[] {
    return this.grants.filter((grant) => !resourceId || grant.resourceId === resourceId);
  }

  active(now = new Date()): CaseGrant[] {
    return this.grants.filter(
      (grant) =>
        !grant.revokedAt &&
        (!grant.expiresAt || Date.parse(grant.expiresAt) > now.getTime()),
    );
  }

  toAuthorizationGrants(now = new Date()): Grant[] {
    return this.active(now).map((grant) => ({
      resourceId: grant.resourceId,
      granteeUserId: grant.granteeUserId,
      granteeOrgId: grant.granteeOrgId,
      actions: grant.actions,
      grantedBy: grant.grantedBy,
      revokedAt: grant.revokedAt,
      expiresAt: grant.expiresAt,
    }));
  }

  grant(input: GrantInput, now = new Date()): CaseGrant {
    if (!/^case_\d{6}$/.test(input.resourceId)) {
      throw new GrantError("Recurso no válido");
    }
    const hasUser = Boolean(input.granteeUserId);
    const hasOrg = Boolean(input.granteeOrgId);
    if (hasUser === hasOrg) {
      throw new GrantError("Indica un destinatario (usuario u organización), solo uno");
    }
    if (input.granteeUserId && input.granteeUserId === input.grantedBy) {
      throw new GrantError("No puedes compartir un recurso contigo mismo");
    }
    const actions = [...new Set(input.actions)] as Action[];
    if (actions.length === 0) throw new GrantError("Selecciona al menos un permiso");
    for (const action of actions) {
      if (!SHAREABLE_ACTIONS.includes(action)) {
        throw new GrantError(`Permiso no compartible: ${action}`);
      }
    }
    if (input.expiresAt) {
      const time = Date.parse(input.expiresAt);
      if (Number.isNaN(time)) throw new GrantError("Caducidad no válida");
      if (time <= now.getTime()) throw new GrantError("La caducidad debe estar en el futuro");
    }

    const grant: CaseGrant = {
      id: `grt_${crypto.randomBytes(8).toString("hex")}`,
      resourceId: input.resourceId,
      granteeUserId: input.granteeUserId ?? null,
      granteeOrgId: input.granteeOrgId ?? null,
      actions,
      grantedBy: input.grantedBy,
      createdAt: now.toISOString(),
      expiresAt: input.expiresAt ?? null,
      revokedAt: null,
    };
    this.grants.push(grant);
    return grant;
  }

  revoke(grantId: string, now = new Date()): CaseGrant {
    const grant = this.grants.find((item) => item.id === grantId);
    if (!grant) throw new GrantError("Concesión no encontrada");
    if (grant.revokedAt) return grant;
    grant.revokedAt = now.toISOString();
    return grant;
  }
}
