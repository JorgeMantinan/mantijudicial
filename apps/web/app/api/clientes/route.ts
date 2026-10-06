import { leerJson } from "@/lib/api-body";
import { NextResponse } from "next/server";
import { can, canCreateCase } from "@pipeline/authorization";
import { defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { setCliente } from "@/lib/dataset";
import { loadGrantStore } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Asigna (o quita) el cliente/encargo de un caso. */
export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite editar casos" }, { status: 403 });
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
  const cliente = typeof body.cliente === "string" ? body.cliente : "";

  const orgId = await defaultOrgId();
  const grants = (await loadGrantStore()).toAuthorizationGrants();
  if (!can(actor, "VIEW", await recursoCaso(caseId), grants)) {
    return NextResponse.json({ error: "No puedes modificar ese caso" }, { status: 403 });
  }

  await setCliente(caseId, cliente);
  return NextResponse.json({ ok: true, caseId, cliente: cliente.trim() });
}
