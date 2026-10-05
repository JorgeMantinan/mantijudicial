import { spawn } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { can, canCreateCase } from "@pipeline/authorization";
import { caseResource, defaultOrgId, getActor , recursoCaso } from "@/lib/auth";
import { loadGrantStore } from "@/lib/grants";
import { jobs } from "@/lib/jobs";
import { repoRoot } from "@/lib/dataset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runCompare(jobId: string, primary: string, other: string): Promise<number> {
  const tsxCli = path.join(repoRoot(), "node_modules", "tsx", "dist", "cli.mjs");
  const script = path.join(repoRoot(), "pipeline", "14_compare.ts");
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [tsxCli, script, `--a=${primary}`, `--b=${other}`, "--force"],
      { cwd: repoRoot(), windowsHide: true },
    );
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
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON no válido" }, { status: 400 });
  }
  const caseId = typeof body.caseId === "string" ? body.caseId : "";
  const otherId = typeof body.otherId === "string" ? body.otherId : "";
  if (!/^case_\d{6}$/.test(caseId) || !/^case_\d{6}$/.test(otherId)) {
    return NextResponse.json({ error: "Casos no válidos" }, { status: 400 });
  }
  if (caseId === otherId) {
    return NextResponse.json({ error: "Elige dos casos distintos" }, { status: 400 });
  }
  if (!canCreateCase(actor)) {
    return NextResponse.json({ error: "Tu rol no permite generar análisis" }, { status: 403 });
  }

  const orgId = await defaultOrgId();
  const grants = (await loadGrantStore()).toAuthorizationGrants();
  if (
    !can(actor, "ANALYZE", await recursoCaso(caseId), grants) ||
    !can(actor, "VIEW", await recursoCaso(otherId), grants)
  ) {
    return NextResponse.json({ error: "No puedes analizar esos casos" }, { status: 403 });
  }

  const job = jobs.create("compare");
  jobs.patch(job.id, { status: "queued", caseId });
  jobs.append(job.id, `Comparando ${caseId} con ${otherId} (≈$0,003 de IA)`);

  void jobs
    .runExclusive(async () => {
      jobs.patch(job.id, { status: "running" });
      try {
        const code = await runCompare(job.id, caseId, otherId);
        jobs.patch(job.id, {
          status: code === 0 ? "done" : "error",
          finishedAt: new Date().toISOString(),
          error: code === 0 ? undefined : `el proceso terminó con código ${code}`,
        });
      } catch (error) {
        jobs.patch(job.id, {
          status: "error",
          finishedAt: new Date().toISOString(),
          error: String(error),
        });
      }
    })
    .catch(() => undefined);

  return NextResponse.json({ jobId: job.id, status: jobs.get(job.id)?.status }, { status: 202 });
}
