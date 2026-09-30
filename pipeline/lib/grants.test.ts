import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { can, type Actor, type Resource } from "./authorization.js";
import { GrantError, GrantStore } from "./grants.js";

const tmp = path.join(os.tmpdir(), `mj-grants-${process.pid}-${Date.now()}`);
const storePath = path.join(tmp, "grants.json");

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const NOW = new Date("2026-09-30T10:00:00.000Z");
const RECIPIENT: Actor = { userId: "B", orgId: "FIRM_B", role: "LAWYER", orgIds: ["FIRM_B"] };
const DOC_A: Resource = {
  id: "case_000034",
  kind: "case",
  ownerUserId: "A",
  ownerOrgId: "FIRM_A",
  visibility: "ORGANIZATION_PRIVATE",
  privacy: "CLIENT_CONFIDENTIAL",
};

describe("GrantStore", () => {
  it("compartir → el destinatario ve; revocar → deja de ver", async () => {
    const store = GrantStore.empty();
    store.grant(
      {
        resourceId: DOC_A.id,
        granteeUserId: "B",
        actions: ["VIEW"],
        grantedBy: "A",
      },
      NOW,
    );
    const grants = store.toAuthorizationGrants(NOW);
    expect(can(RECIPIENT, "VIEW", DOC_A, grants, NOW)).toBe(true);
    expect(can(RECIPIENT, "EDIT", DOC_A, grants, NOW)).toBe(false);

    const grant = store.list(DOC_A.id)[0]!;
    store.revoke(grant.id, NOW);
    expect(can(RECIPIENT, "VIEW", DOC_A, store.toAuthorizationGrants(NOW), NOW)).toBe(false);
    expect(store.list(DOC_A.id)[0]?.revokedAt).toBe(NOW.toISOString());
  });

  it("solo concede los permisos marcados", () => {
    const store = GrantStore.empty();
    store.grant(
      { resourceId: DOC_A.id, granteeUserId: "B", actions: ["VIEW", "ANALYZE"], grantedBy: "A" },
      NOW,
    );
    const grants = store.toAuthorizationGrants(NOW);
    expect(can(RECIPIENT, "ANALYZE", DOC_A, grants, NOW)).toBe(true);
    expect(can(RECIPIENT, "DOWNLOAD", DOC_A, grants, NOW)).toBe(false);
    expect(can(RECIPIENT, "SHARE", DOC_A, grants, NOW)).toBe(false);
  });

  it("la concesión caducada no se aplica", () => {
    const store = GrantStore.empty();
    store.grant(
      {
        resourceId: DOC_A.id,
        granteeUserId: "B",
        actions: ["VIEW"],
        grantedBy: "A",
        expiresAt: "2026-10-01T00:00:00.000Z",
      },
      NOW,
    );
    const after = new Date("2026-10-02T00:00:00.000Z");
    expect(can(RECIPIENT, "VIEW", DOC_A, store.toAuthorizationGrants(after), after)).toBe(false);
  });

  it("valida los datos de la concesión", () => {
    const store = GrantStore.empty();
    expect(() =>
      store.grant({ resourceId: "DOC_A", granteeUserId: "B", actions: ["VIEW"], grantedBy: "A" }, NOW),
    ).toThrow(GrantError);
    expect(() =>
      store.grant(
        { resourceId: DOC_A.id, granteeUserId: "B", actions: [], grantedBy: "A" },
        NOW,
      ),
    ).toThrow("al menos un permiso");
    expect(() =>
      store.grant(
        { resourceId: DOC_A.id, granteeUserId: "B", actions: ["DELETE"], grantedBy: "A" },
        NOW,
      ),
    ).toThrow("no compartible");
    expect(() =>
      store.grant(
        { resourceId: DOC_A.id, granteeUserId: "A", actions: ["VIEW"], grantedBy: "A" },
        NOW,
      ),
    ).toThrow("contigo mismo");
    expect(() =>
      store.grant(
        { resourceId: DOC_A.id, granteeUserId: "B", granteeOrgId: "FIRM_B", actions: ["VIEW"], grantedBy: "A" },
        NOW,
      ),
    ).toThrow("solo uno");
    expect(() =>
      store.grant(
        {
          resourceId: DOC_A.id,
          granteeUserId: "B",
          actions: ["VIEW"],
          grantedBy: "A",
          expiresAt: "2026-09-01T00:00:00.000Z",
        },
        NOW,
      ),
    ).toThrow("futuro");
  });

  it("persiste y recarga con el histórico", async () => {
    const store = GrantStore.empty();
    const grant = store.grant(
      { resourceId: DOC_A.id, granteeOrgId: "FIRM_B", actions: ["VIEW"], grantedBy: "A" },
      NOW,
    );
    store.revoke(grant.id, NOW);
    await store.save(storePath);

    const reloaded = await GrantStore.load(storePath);
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.list()[0]?.revokedAt).toBeTruthy();
    expect(reloaded.active(NOW)).toHaveLength(0);
    expect(await GrantStore.load(path.join(tmp, "no.json"))).toBeTruthy();
  });
});
