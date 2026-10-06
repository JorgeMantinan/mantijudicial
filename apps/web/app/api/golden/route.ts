import { leerJson } from "@/lib/api-body";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { can, canCreateCase } from "@pipeline/authorization";
import type { GoldenEntry } from "@pipeline/eval";
import { defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { getGoldenInfo, repoRoot } from "@/lib/dataset";
import { auditPath, loadGrantStore } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTCOMES = ["ESTIMED", "DISMISSED", "PARTIALLY_ESTIMATED", "UNKNOWN"];

function goldenPath(): string {
  return path.join(repoRoot(), "cases", "golden.json");
}

async function readGolden(): Promise<GoldenEntry[]> {
  const raw = await fs.readFile(goldenPath(), "utf8").catch(() => "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { entries?: GoldenEntry[] };
    return parsed.entries ?? [];
  } catch {
    return [];
  }
}

async function writeGolden(entries: GoldenEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(goldenPath()), { recursive: true });
  await fs.writeFile(goldenPath(), `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, "utf8");
}

async function authorize(caseId: string, action: "VIEW" | "EDIT"): Promise<NextResponse | null> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const orgId = await defaultOrgId();
  const grants = (await loadGrantStore()).toAuthorizationGrants();
  if (!can(actor, action, await recursoCaso(caseId), grants)) {
    return NextResponse.json({ error: "No tienes permiso sobre este caso" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const caseId = new URL(request.url).searchParams.get("resource");
  if (!caseId || !/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "resource no válido" }, { status: 400 });
  }
  const denied = await authorize(caseId, "VIEW");
  if (denied) return denied;
  const info = await getGoldenInfo(caseId);
  if (!info) return NextResponse.json({ error: "Caso no encontrado" }, { status: 404 });
  return NextResponse.json(info);
}

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite validar casos" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await leerJson(request);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  if (!/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "Caso no válido" }, { status: 400 });
  }
  const denied = await authorize(caseId, "EDIT");
  if (denied) return denied;

  const confirm = body.confirm === true;
  const expect =
    body.expect && typeof body.expect === "object"
      ? (body.expect as GoldenEntry["expect"])
      : {};

  if (expect.cassation_outcome && !OUTCOMES.includes(expect.cassation_outcome)) {
    return NextResponse.json({ error: "Resultado no válido" }, { status: 400 });
  }
  if (expect.must_cite_boe_ids && !Array.isArray(expect.must_cite_boe_ids)) {
    return NextResponse.json({ error: "Normas no válidas" }, { status: 400 });
  }

  const entries = await readGolden();
  const index = entries.findIndex((item) => item.caseId === caseId);
  const base: GoldenEntry =
    index >= 0
      ? entries[index]!
      : {
          caseId,
          expect: {},
          source: "auto-rule",
          confirmed: false,
          notes: "Creado desde la interfaz",
        };

  const updated: GoldenEntry = {
    ...base,
    expect: { ...base.expect, ...expect },
    confirmed: confirm,
    source: confirm ? "human" : base.source,
    notes: confirm
      ? "Verificado a mano desde la interfaz"
      : "Pendiente de verificación manual contra el PDF",
  };
  if (index >= 0) entries[index] = updated;
  else entries.push(updated);
  await writeGolden(entries);

  await appendAudit(auditPath(), {
    actor: actor.userId,
    action: "golden.confirm",
    resource: caseId,
    details: { confirm, fields: Object.keys(expect) },
  });

  return NextResponse.json({ ok: true, entry: updated });
}
