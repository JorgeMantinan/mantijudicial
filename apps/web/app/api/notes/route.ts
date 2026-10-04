import path from "node:path";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { NoteError, NoteStore } from "@pipeline/notes";
import { can } from "@pipeline/authorization";
import { caseResource, defaultOrgId, getActor, loadIdentity } from "@/lib/auth";
import { auditPath, grantsPath, loadGrantStore } from "@/lib/grants";
import { repoRoot } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notesPath(caseId: string): string {
  return path.join(repoRoot(), "cases", caseId, "structured", "notes.json");
}

async function loadGrants() {
  return (await loadGrantStore()).toAuthorizationGrants();
}

export async function GET(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const caseId = new URL(request.url).searchParams.get("resource");
  if (!caseId || !/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "resource no válido" }, { status: 400 });
  }
  const orgId = await defaultOrgId();
  const grants = await loadGrants();
  if (!can(actor, "VIEW", caseResource(caseId, orgId), grants)) {
    return NextResponse.json({ error: "No puedes ver este caso" }, { status: 403 });
  }
  const store = await NoteStore.load(notesPath(caseId));
  return NextResponse.json({ notes: store.listFor(actor.userId, caseId) });
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
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const text = typeof body.text === "string" ? body.text : "";
  if (!/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "Caso no válido" }, { status: 400 });
  }
  const orgId = await defaultOrgId();
  const grants = await loadGrants();
  if (!can(actor, "VIEW", caseResource(caseId, orgId), grants)) {
    return NextResponse.json({ error: "No puedes ver este caso" }, { status: 403 });
  }

  try {
    const identity = await loadIdentity();
    const user = identity.listUsers().find((item) => item.id === actor.userId);
    const store = await NoteStore.load(notesPath(caseId));
    const note = store.add({
      caseId,
      userId: actor.userId,
      userName: user?.name ?? actor.userId,
      text,
    });
    await store.save(notesPath(caseId), caseId);
    await appendAudit(auditPath(), {
      actor: actor.userId,
      action: "note.create",
      resource: caseId,
      details: { noteId: note.id, chars: note.text.length },
    });
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch (error) {
    const message = error instanceof NoteError ? error.message : "No se pudo guardar la nota";
    return NextResponse.json({ error: message }, { status: 400 });
  }
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
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const noteId = typeof body.noteId === "string" ? body.noteId : "";
  if (!/^case_\d{6}$/.test(caseId) || !noteId) {
    return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  }
  const orgId = await defaultOrgId();
  const grants = await loadGrants();
  if (!can(actor, "VIEW", caseResource(caseId, orgId), grants)) {
    return NextResponse.json({ error: "No puedes editar este caso" }, { status: 403 });
  }

  try {
    const store = await NoteStore.load(notesPath(caseId));
    const removed = store.remove(noteId, actor.userId);
    await store.save(notesPath(caseId), caseId);
    await appendAudit(auditPath(), {
      actor: actor.userId,
      action: "note.delete",
      resource: caseId,
      details: { noteId: removed.id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof NoteError ? error.message : "No se pudo borrar la nota";
    const status = message.includes("autor") || message.includes("encontrada") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
