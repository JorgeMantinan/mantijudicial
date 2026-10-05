import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { deleteBusqueda, getBusquedas, saveBusqueda } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({ busquedas: await getBusquedas(actor.orgId) });
}

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 60) : "";
  const q = typeof body.q === "string" ? body.q.trim().slice(0, 200) : "";
  if (!nombre || !q) {
    return NextResponse.json({ error: "Falta el nombre o la consulta" }, { status: 400 });
  }

  const busquedas = await saveBusqueda(actor.orgId, {
    nombre,
    q,
    kind: typeof body.kind === "string" && body.kind ? body.kind.slice(0, 40) : undefined,
    branch: typeof body.branch === "string" && body.branch ? body.branch.slice(0, 40) : undefined,
    outcome: typeof body.outcome === "string" && body.outcome ? body.outcome.slice(0, 40) : undefined,
    at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, busquedas });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const nombre = typeof body.nombre === "string" ? body.nombre : "";
  if (!nombre) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });

  const busquedas = await deleteBusqueda(actor.orgId, nombre);
  return NextResponse.json({ ok: true, busquedas });
}
