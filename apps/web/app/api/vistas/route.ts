import { leerJson } from "@/lib/api-body";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { deleteVista, saveVista } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await leerJson(request);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const nombre = typeof body.nombre === "string" ? body.nombre.trim().slice(0, 60) : "";
  const qs = body.qs;
  if (!nombre || !qs || typeof qs !== "object") {
    return NextResponse.json({ error: "Falta el nombre o los filtros" }, { status: 400 });
  }
  const limpia: Record<string, string> = {};
  for (const [clave, valor] of Object.entries(qs as Record<string, unknown>).slice(0, 20)) {
    if (typeof valor === "string" && valor) limpia[clave.slice(0, 40)] = valor.slice(0, 120);
  }
  const vistas = await saveVista(actor.orgId, { nombre, qs: limpia });
  return NextResponse.json({ ok: true, vistas });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await leerJson(request);
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const nombre = typeof body.nombre === "string" ? body.nombre : "";
  if (!nombre) return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  const vistas = await deleteVista(actor.orgId, nombre);
  return NextResponse.json({ ok: true, vistas });
}
