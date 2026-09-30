import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { jobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  return NextResponse.json({
    jobs: jobs.list().map((job) => ({
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
