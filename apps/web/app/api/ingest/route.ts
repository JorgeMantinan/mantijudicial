import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { canCreateCase } from "@pipeline/authorization";
import { jobs } from "@/lib/jobs";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { repoRoot } from "@/lib/dataset";
import { auditPath, authorizationGrants } from "@/lib/grants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

function runIngest(
  jobId: string,
  uploadPath: string,
  source: string,
): Promise<{ code: number; caseId: string | null }> {
  const tsxCli = path.join(repoRoot(), "node_modules", "tsx", "dist", "cli.mjs");
  const script = path.join(repoRoot(), "pipeline", "09_ingest.ts");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tsxCli, script, `--file=${uploadPath}`, `--source=${source}`],
      { cwd: repoRoot(), windowsHide: true },
    );
    let output = "";
    const capture = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      output += text;
      for (const line of text.split(/\r?\n/)) {
        if (line.trim().length > 0) jobs.append(jobId, line.trimEnd());
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", reject);
    child.on("close", (code) => {
      const match = /Caso:\s+(case_\d{6})/.exec(output);
      resolve({ code: code ?? 1, caseId: match?.[1] ?? null });
    });
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite crear casos" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario no válido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Falta el PDF" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "El PDF supera 25 MB" }, { status: 413 });
  }
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  if (head !== "%PDF-") {
    return NextResponse.json({ error: "El fichero no es un PDF" }, { status: 415 });
  }

  const source =
    typeof form.get("source") === "string" && (form.get("source") as string).trim().length > 0
      ? (form.get("source") as string).trim().slice(0, 60)
      : "UPLOAD";

  const uploadsDir = path.join(repoRoot(), "data", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-60) || "documento.pdf";
  const uploadPath = path.join(uploadsDir, `${Date.now().toString(36)}_${safeName}`);
  await fs.writeFile(uploadPath, Buffer.from(await file.arrayBuffer()));

  const job = jobs.create("ingest");
  jobs.patch(job.id, { status: "queued" });
  jobs.append(job.id, `Recibido: ${file.name} (${file.size} bytes) · fuente=${source}`);

  void jobs
    .runExclusive(async () => {
      jobs.patch(job.id, { status: "running" });
      try {
        const result = await runIngest(job.id, uploadPath, source);
        if (result.caseId) {
          jobs.patch(job.id, { caseId: result.caseId });
          await appendAudit(auditPath(), {
            actor: actor.userId,
            action: "case.ingest",
            resource: result.caseId,
            details: { source, archivo: file.name },
          });
        }
        jobs.patch(job.id, {
          status: result.code === 0 ? "done" : "error",
          finishedAt: new Date().toISOString(),
          error: result.code === 0 ? undefined : `el pipeline terminó con código ${result.code}`,
        });
      } finally {
        await fs.rm(uploadPath, { force: true }).catch(() => undefined);
      }
    })
    .catch((error: unknown) => {
      jobs.patch(job.id, {
        status: "error",
        finishedAt: new Date().toISOString(),
        error: String(error),
      });
    });

  return NextResponse.json({ jobId: job.id, status: jobs.get(job.id)?.status }, { status: 202 });
}

export async function GET(): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const visibles = jobs
    .list()
    .filter((job) => !job.caseId || canViewCase(actor, job.caseId, orgId, grants));
  return NextResponse.json({
    jobs: visibles.map((job) => ({
      id: job.id,
      status: job.status,
      caseId: job.caseId ?? null,
      lines: job.lines.slice(-30),
      error: job.error ?? null,
    })),
  });
}
