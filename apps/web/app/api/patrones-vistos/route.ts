import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { desmarcarPatrones, marcarPatronVisto } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const ejemplo = typeof body.ejemplo === "string" ? body.ejemplo.trim() : "";
  if (!ejemplo) return NextResponse.json({ error: "Falta la frase" }, { status: 400 });

  await marcarPatronVisto(actor.orgId, ejemplo);
  return NextResponse.json({ ok: true });
}

export async function DELETE(): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  await desmarcarPatrones(actor.orgId);
  return NextResponse.json({ ok: true });
}
