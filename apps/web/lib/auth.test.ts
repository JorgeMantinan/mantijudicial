import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Action, Actor, Grant } from "@pipeline/authorization";
import type { CaseListItem } from "./dataset-base";

/**
 * `canViewCase` resuelve el dueño real del caso leyendo `data/casos_org.json`
 * del disco. Para no depender de los datos locales, el test apunta
 * `MANTIJUDICIAL_ROOT` a un corpus temporal de un solo caso registrado
 * (`case_000777` → `org_dueno`) y carga `./auth` después de fijar la raíz.
 */
let raiz: string;
let auth: typeof import("./auth");
let rootPrevio: string | undefined;

beforeAll(async () => {
  rootPrevio = process.env.MANTIJUDICIAL_ROOT;
  raiz = await mkdtemp(path.join(tmpdir(), "mj-auth-"));
  await mkdir(path.join(raiz, "cases"), { recursive: true });
  await mkdir(path.join(raiz, "data"), { recursive: true });
  await writeFile(
    path.join(raiz, "data", "casos_org.json"),
    JSON.stringify({ case_000777: "org_dueno" }),
    "utf8",
  );
  process.env.MANTIJUDICIAL_ROOT = raiz;
  auth = await import("./auth");
});

afterAll(async () => {
  if (rootPrevio === undefined) delete process.env.MANTIJUDICIAL_ROOT;
  else process.env.MANTIJUDICIAL_ROOT = rootPrevio;
  await rm(raiz, { recursive: true, force: true });
});

function abogado(orgId: string): Actor {
  return { userId: `u_${orgId}`, orgId, role: "LAWYER", orgIds: [orgId] };
}

function concesion(resourceId: string, orgId: string, actions: Action[]): Grant {
  return {
    resourceId,
    granteeUserId: null,
    granteeOrgId: orgId,
    actions,
    grantedBy: "admin_local",
    revokedAt: null,
    expiresAt: null,
  };
}

function caso(id: string, reviewStatus: string): CaseListItem {
  return {
    id,
    headline: "Sentencia de prueba sobre cláusula suelo",
    subtopic: "Novación y restitución de cantidades",
    branch: "CONSUMER_ABUSIVE_CLAUSES",
    outcome: "ESTIMED",
    recurringSide: "CONSUMER",
    enriched: true,
    reviewStatus,
    stale: false,
    archived: false,
    generatedAt: "2026-01-10T10:00:00.000Z",
    reviewedAt: "",
  };
}

describe("canViewCase", () => {
  it("el despacho dueño ve su caso", () => {
    expect(auth.canViewCase(abogado("org_a"), "case_000001", "org_a", [])).toBe(true);
  });

  it("otro despacho sin concesión no lo ve", () => {
    expect(auth.canViewCase(abogado("org_b"), "case_000001", "org_a", [])).toBe(false);
  });

  it("una concesión VIEW entre despachos abre el acceso", () => {
    const grants = [concesion("case_000001", "org_b", ["VIEW"])];
    expect(auth.canViewCase(abogado("org_b"), "case_000001", "org_a", grants)).toBe(true);
  });

  it("una concesión con otra acción no da vista", () => {
    const grants = [concesion("case_000001", "org_b", ["EDIT"])];
    expect(auth.canViewCase(abogado("org_b"), "case_000001", "org_a", grants)).toBe(false);
  });

  // canViewCase exige el formato completo case_XXXXXX (misma barrera que
  // esCaseId), sin llegar a tocar el disco.
  it("deniega ids con formato inválido sin tocar el disco", () => {
    expect(auth.canViewCase(abogado("org_a"), "../../data/identity", "org_a", [])).toBe(false);
    expect(auth.canViewCase(abogado("org_a"), "identity.json", "org_a", [])).toBe(false);
    expect(auth.canViewCase(abogado("org_a"), "", "org_a", [])).toBe(false);
    expect(auth.canViewCase(abogado("org_a"), "case_1", "org_a", [])).toBe(false);
  });

  it("el dueño registrado en casos_org ve su caso aunque el org por defecto sea otro", () => {
    expect(auth.canViewCase(abogado("org_dueno"), "case_000777", "org_default", [])).toBe(true);
  });

  it("el despacho por defecto no ve el caso subido por otro despacho", () => {
    expect(auth.canViewCase(abogado("org_default"), "case_000777", "org_default", [])).toBe(false);
  });
});

describe("porStatus", () => {
  const casos = [
    caso("case_000001", "REVIEWED"),
    caso("case_000002", "UNREVIEWED"),
    caso("case_000003", "IN_PROGRESS"),
  ];

  it("con TODOS devuelve la lista entera", () => {
    expect(auth.porStatus(casos, "TODOS")).toHaveLength(3);
  });

  it("filtra por el estado pedido", () => {
    expect(auth.porStatus(casos, "UNREVIEWED").map((item) => item.id)).toEqual(["case_000002"]);
  });

  it("devuelve vacío si ningún caso tiene ese estado", () => {
    expect(auth.porStatus(casos, "REJECTED")).toEqual([]);
  });
});
