import { NextResponse } from "next/server";
import { canViewCase, defaultOrgId, getActor } from "@/lib/auth";
import { authorizationGrants } from "@/lib/grants";
import { jobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const visibles = jobs
    .list()
    .filter((job) => {
      if (job.orgId && job.orgId !== actor.orgId) return false;
      return !job.caseId || canViewCase(actor, job.caseId, orgId, grants);
    });
  return NextResponse.json({
    jobs: visibles.map((job) => ({
      id: job.id,
      kind: job.kind,
      status: job.status,
      caseId: job.caseId ?? null,
      lines: job.lines.slice(-40),
      error: job.error ?? null,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt ?? null,
    })),
  });
}
