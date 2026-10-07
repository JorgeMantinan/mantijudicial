import { leerJson } from "@/lib/api-body";
import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { appendAudit } from "@pipeline/audit";
import { can, canCreateCase } from "@pipeline/authorization";
import { defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { auditPath, loadGrantStore } from "@/lib/grants";
import { jobs } from "@/lib/jobs";
import { repoRoot } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runEnrich(jobId: string, caseId: string): Promise<number> {
  const tsxCli = path.join(repoRoot(), "node_modules", "tsx", "dist", "cli.mjs");
  const script = path.join(repoRoot(), "pipeline", "04_enrich.ts");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, script, `--cases=${caseId}`, "--force"], {
      cwd: repoRoot(),
      windowsHide: true,
    });
    const capture = (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/)) {
        if (line.trim()) jobs.append(jobId, line.trimEnd());
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

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
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite reanalizar casos" }, { status: 403 });
  }
  const orgId = await defaultOrgId();
  const grants = (await loadGrantStore()).toAuthorizationGrants();
  if (!can(actor, "ANALYZE", await recursoCaso(caseId), grants)) {
    return NextResponse.json({ error: "No puedes analizar este caso" }, { status: 403 });
  }

  // Tope de cola ATÓMICO: comprobación y creación seguidas, sin awaits
  // intermedios, para que dos peticiones concurrentes no pasen de 5.
  if (jobs.enCola(actor.orgId) >= 5) {
    return NextResponse.json(
      { error: "Ya tienes 5 trabajos en cola: espera a que terminen" },
      { status: 429 },
    );
  }
  const job = jobs.create("reanalyze");
  jobs.patch(job.id, { status: "queued", caseId, orgId: actor.orgId });
  jobs.append(job.id, `Reanálisis solicitado por ${actor.userId} (~$0,01 de IA)`);

  void jobs
    .runExclusive(async () => {
      jobs.patch(job.id, { status: "running" });
      try {
        const code = await runEnrich(job.id, caseId);
        jobs.patch(job.id, {
          status: code === 0 ? "done" : "error",
          finishedAt: new Date().toISOString(),
          error: code === 0 ? undefined : `el pipeline terminó con código ${code}`,
        });
        if (code === 0) {
          await appendAudit(auditPath(), {
            actor: actor.userId,
            action: "case.reanalyze",
            resource: caseId,
            details: { jobId: job.id },
          });
        }
      } finally {
        // nada más: el estado ya está actualizado
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
