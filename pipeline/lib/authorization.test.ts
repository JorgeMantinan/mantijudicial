import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  assertCan,
  authorizedForRetrieval,
  can,
  canCreateCase,
  filterVisible,
  type Actor,
  type Grant,
  type Resource,
} from "./authorization.js";

const NOW = new Date("2026-09-30T10:00:00.000Z");

function resource(overrides: Partial<Resource>): Resource {
  return {
    id: "R1",
    kind: "case",
    ownerUserId: null,
    ownerOrgId: null,
    visibility: "ORGANIZATION_PRIVATE",
    privacy: "CLIENT_CONFIDENTIAL",
    ...overrides,
  };
}

function actor(overrides: Partial<Actor>): Actor {
  return { userId: "u1", orgId: "ORG_1", role: "LAWYER", orgIds: ["ORG_1"], ...overrides };
}

function grant(overrides: Partial<Grant>): Grant {
  return {
    resourceId: "R1",
    granteeUserId: null,
    granteeOrgId: null,
    actions: ["VIEW"],
    grantedBy: "owner",
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

const DOC_A = resource({
  id: "DOC_A",
  kind: "document",
  ownerUserId: "LAWYER_A",
  ownerOrgId: "FIRM_A",
  visibility: "LAWYER_PRIVATE",
});
const DOC_B = resource({
  id: "DOC_B",
  kind: "document",
  ownerUserId: "LAWYER_B",
  ownerOrgId: "FIRM_B",
  visibility: "LAWYER_PRIVATE",
});
const LAWYER_A = actor({ userId: "LAWYER_A", orgId: "FIRM_A", orgIds: ["FIRM_A"] });
const LAWYER_B = actor({ userId: "LAWYER_B", orgId: "FIRM_B", orgIds: ["FIRM_B"] });
const ADMIN_A = actor({ userId: "ADMIN_A", orgId: "FIRM_A", role: "ORG_ADMIN", orgIds: ["FIRM_A"] });
const PLATFORM = actor({ userId: "ROOT", orgId: "PLATFORM", role: "PLATFORM_ADMIN", orgIds: [] });

describe("aislamiento entre despachos (test obligatorio)", () => {
  it("LAWYER_A falla al leer, buscar, descargar y analizar DOC_B", () => {
    expect(can(LAWYER_A, "VIEW", DOC_B, [])).toBe(false);
    expect(can(LAWYER_A, "DOWNLOAD", DOC_B, [])).toBe(false);
    expect(can(LAWYER_A, "ANALYZE", DOC_B, [])).toBe(false);
    expect(can(LAWYER_A, "EDIT", DOC_B, [])).toBe(false);
    expect(() => assertCan(LAWYER_A, "VIEW", DOC_B, [])).toThrow(AuthorizationError);
    expect(authorizedForRetrieval(LAWYER_A, [DOC_A, DOC_B], []).map((item) => item.id)).toEqual([
      "DOC_A",
    ]);
    expect(
      filterVisible(
        LAWYER_A,
        [{ id: "DOC_A" }, { id: "DOC_B" }],
        (id) => (id === "DOC_A" ? DOC_A : DOC_B),
        [],
      ),
    ).toEqual([{ id: "DOC_A" }]);
  });

  it("conocer el identificador no concede acceso", () => {
    expect(can(LAWYER_A, "VIEW", { ...DOC_B, id: "DOC_B" }, [])).toBe(false);
  });
});

describe("compartir y revocar", () => {
  it("A comparte → B ve", () => {
    const grants = [grant({ resourceId: "DOC_A", granteeUserId: "LAWYER_B", actions: ["VIEW"] })];
    expect(can(LAWYER_B, "VIEW", DOC_A, grants, NOW)).toBe(true);
  });

  it("A revoca → B deja de ver", () => {
    const grants = [
      grant({
        resourceId: "DOC_A",
        granteeUserId: "LAWYER_B",
        actions: ["VIEW"],
        revokedAt: "2026-09-30T09:00:00.000Z",
      }),
    ];
    expect(can(LAWYER_B, "VIEW", DOC_A, grants, NOW)).toBe(false);
  });

  it("A no comparte → B no descubre el recurso", () => {
    expect(
      filterVisible(
        LAWYER_B,
        [{ id: "DOC_A" }, { id: "DOC_B" }],
        (id) => (id === "DOC_A" ? DOC_A : DOC_B),
        [],
      ),
    ).toEqual([{ id: "DOC_B" }]);
  });

  it("concesión VIEW → B no puede editar", () => {
    const grants = [grant({ resourceId: "DOC_A", granteeUserId: "LAWYER_B", actions: ["VIEW"] })];
    expect(can(LAWYER_B, "VIEW", DOC_A, grants, NOW)).toBe(true);
    expect(can(LAWYER_B, "EDIT", DOC_A, grants, NOW)).toBe(false);
  });

  it("concesión VIEW+ANALYZE → analiza pero no descarga", () => {
    const grants = [
      grant({ resourceId: "DOC_A", granteeUserId: "LAWYER_B", actions: ["VIEW", "ANALYZE"] }),
    ];
    expect(can(LAWYER_B, "ANALYZE", DOC_A, grants, NOW)).toBe(true);
    expect(can(LAWYER_B, "DOWNLOAD", DOC_A, grants, NOW)).toBe(false);
    expect(authorizedForRetrieval(LAWYER_B, [DOC_A], grants, NOW)).toEqual([DOC_A]);
  });

  it("la concesión expirada no vale", () => {
    const grants = [
      grant({
        resourceId: "DOC_A",
        granteeUserId: "LAWYER_B",
        actions: ["VIEW"],
        expiresAt: "2026-09-30T09:59:00.000Z",
      }),
    ];
    expect(can(LAWYER_B, "VIEW", DOC_A, grants, NOW)).toBe(false);
  });

  it("la concesión a otro usuario no aprovecha a B", () => {
    const grants = [grant({ resourceId: "DOC_A", granteeUserId: "OTRO", actions: ["VIEW"] })];
    expect(can(LAWYER_B, "VIEW", DOC_A, grants, NOW)).toBe(false);
  });
});

describe("roles y propiedad", () => {
  const firmCase = resource({ id: "C_FIRM", ownerOrgId: "FIRM_A", ownerUserId: null });
  const lawyerCase = resource({
    id: "C_LAWYER",
    ownerOrgId: "FIRM_A",
    ownerUserId: "LAWYER_A",
    visibility: "LAWYER_PRIVATE",
  });

  it("el propietario controla su caso privado", () => {
    expect(can(LAWYER_A, "EDIT", lawyerCase, [])).toBe(true);
    expect(can(LAWYER_A, "DELETE", lawyerCase, [])).toBe(true);
    expect(can(LAWYER_A, "SHARE", lawyerCase, [])).toBe(true);
  });

  it("FIRM_ADMIN no tiene acceso universal a lo privado de sus abogados", () => {
    expect(can(ADMIN_A, "VIEW", lawyerCase, [])).toBe(false);
    expect(can(ADMIN_A, "EDIT", lawyerCase, [])).toBe(false);
  });

  it("FIRM_ADMIN gestiona lo propiedad del despacho", () => {
    expect(can(ADMIN_A, "EDIT", firmCase, [])).toBe(true);
    expect(can(ADMIN_A, "DELETE", firmCase, [])).toBe(true);
  });

  it("PLATFORM_ADMIN no tiene acceso automático al contenido jurídico", () => {
    expect(can(PLATFORM, "VIEW", firmCase, [])).toBe(false);
    expect(can(PLATFORM, "VIEW", lawyerCase, [])).toBe(false);
    expect(can(PLATFORM, "VIEW", DOC_B, [])).toBe(false);
  });

  it("los roles solo ven lo que su rol permite en lo del despacho", () => {
    const viewer = actor({ userId: "v", orgId: "FIRM_A", role: "VIEWER" });
    const paralegal = actor({ userId: "p", orgId: "FIRM_A", role: "PARALEGAL" });
    expect(can(viewer, "VIEW", firmCase, [])).toBe(true);
    expect(can(viewer, "DOWNLOAD", firmCase, [])).toBe(false);
    expect(can(paralegal, "VIEW", firmCase, [])).toBe(true);
    expect(can(paralegal, "DOWNLOAD", firmCase, [])).toBe(false);
    expect(can(paralegal, "ANALYZE", firmCase, [])).toBe(true);
  });

  it("nadie de otro despacho accede a lo del despacho sin concesión", () => {
    expect(can(LAWYER_B, "VIEW", firmCase, [])).toBe(false);
  });
});

describe("multi-organización", () => {
  const caseB = resource({ id: "C_B", ownerOrgId: "FIRM_B", ownerUserId: null });
  const dual = actor({ userId: "DUAL", orgId: "FIRM_A", orgIds: ["FIRM_A", "FIRM_B"] });

  it("se actúa siempre a través de una organización concreta", () => {
    expect(can(dual, "VIEW", caseB, [])).toBe(false);
    const switched: Actor = { ...dual, orgId: "FIRM_B" };
    expect(can(switched, "VIEW", caseB, [])).toBe(true);
  });
});

describe("conocimiento público", () => {
  const law = resource({
    id: "BOE-A-1889-4763",
    kind: "knowledge",
    ownerOrgId: null,
    ownerUserId: null,
    visibility: "GLOBAL_PUBLIC",
    privacy: "PUBLIC",
  });

  it("permite ver, analizar y descargar, pero no editar ni compartir", () => {
    expect(can(LAWYER_A, "VIEW", law, [])).toBe(true);
    expect(can(LAWYER_A, "ANALYZE", law, [])).toBe(true);
    expect(can(LAWYER_A, "DOWNLOAD", law, [])).toBe(true);
    expect(can(LAWYER_A, "EDIT", law, [])).toBe(false);
    expect(can(LAWYER_A, "SHARE", law, [])).toBe(false);
  });
});

describe("creación de casos por rol", () => {
  it("solo abogados y administradores crean casos", () => {
    expect(canCreateCase(LAWYER_A)).toBe(true);
    expect(canCreateCase(ADMIN_A)).toBe(true);
    expect(canCreateCase(actor({ userId: "p", role: "PARALEGAL" }))).toBe(false);
    expect(canCreateCase(actor({ userId: "v", role: "VIEWER" }))).toBe(false);
    expect(canCreateCase(PLATFORM)).toBe(false);
  });

  it("el rol solo actúa en su organización", () => {
    const lawyerB: Actor = { ...LAWYER_B, orgId: "FIRM_B" };
    expect(can(lawyerB, "VIEW", firmCaseOf("FIRM_A"), [])).toBe(false);
  });
});

function firmCaseOf(orgId: string): Resource {
  return resource({ id: `C_${orgId}`, ownerOrgId: orgId, ownerUserId: null });
}

describe("el retrieval de IA respeta la matriz", () => {
  it("solo recupera lo que el actor puede analizar", () => {
    const auditor = actor({ userId: "AUDITOR", orgId: "FIRM_C", orgIds: ["FIRM_C"] });
    const grants = [
      grant({ resourceId: "DOC_A", granteeUserId: "AUDITOR", actions: ["VIEW", "ANALYZE"] }),
    ];
    const retrieved = authorizedForRetrieval(auditor, [DOC_A, DOC_B], grants, NOW);
    expect(retrieved.map((item) => item.id)).toEqual(["DOC_A"]);
  });
});
