import { leerJson } from "@/lib/api-body";
import { revalidatePath } from "next/cache";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { can } from "@pipeline/authorization";
import { applyReview, validateReviewUpdate } from "@pipeline/review";
import { defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { repoRoot } from "@/lib/dataset";
import { auditPath } from "@/lib/grants";

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: unknown;
  try {
    body = (await leerJson(request)) as typeof body;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }

  const caseId = (body as { caseId?: unknown } | null)?.caseId;
  if (typeof caseId !== "string" || !/^case_\d{6}$/.test(caseId)) {
    return NextResponse.json({ error: "caseId no válido" }, { status: 400 });
  }

  const orgId = await defaultOrgId();
  if (!can(actor, "EDIT", await recursoCaso(caseId), [])) {
    return NextResponse.json({ error: "No tienes permiso para editar este caso" }, { status: 403 });
  }

  const validation = validateReviewUpdate(body);
  if (!validation.ok || !validation.value) {
    return NextResponse.json({ error: validation.error ?? "Datos no válidos" }, { status: 400 });
  }

  const dir = path.join(repoRoot(), "cases", caseId, "structured");
  const filePath = path.join(dir, "review.json");
  const existing = await fs.readFile(filePath, "utf8").then(
    (text) => JSON.parse(text) as unknown,
    () => null,
  );
  const updated = applyReview(existing, validation.value);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  await appendAudit(auditPath(), {
    actor: actor.userId,
    action: "review.update",
    resource: caseId,
    details: { status: validation.value.status, reviewedBy: validation.value.reviewedBy },
  });

  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
  revalidatePath("/patterns");

  const review = (updated as { review?: unknown }).review;
  return NextResponse.json({ ok: true, caseId, review });
}
