"use client";

import { pedirOpcional, pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface Job {
  id: string;
  status: string;
  caseId: string | null;
  lines: string[];
  error: string | null;
}

export function ReanalyzeButton({ caseId, stale }: { caseId: string; stale: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function poll(jobId: string) {
    const payload = await pedirOpcional<{ jobs: Job[] }>("/api/jobs", { cache: "no-store" });
    const current = payload?.jobs.find((item) => item.id === jobId);
    if (!current) return;
    setJob(current);
    if (current.status === "done" || current.status === "error") {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      if (current.status === "error") setError(current.error ?? "El reanálisis falló");
      startTransition(() => router.refresh());
    }
  }

  async function reanalyze() {
    setError(null);
    setJob(null);
    let payload: { jobId?: string };
    try {
      payload = await pedir(
        "/api/reanalyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        },
        "No se pudo iniciar el reanálisis",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo iniciar el reanálisis");
      return;
    }
    const jobId = payload.jobId;
    if (!jobId) {
      setError("No se pudo iniciar el reanálisis");
      return;
    }
    setJob({ id: jobId, status: "queued", caseId, lines: [], error: null });
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => void poll(jobId), 2000);
  }

  const running = job !== null && job.status !== "done" && job.status !== "error";

  return (
    <div className="section">
      <h2>Análisis</h2>
      <p className="small muted">
        Última extracción con IA. Si el PDF ha cambiado desde entonces, vuelve a analizarlo
        (cuesta ≈ $0,01 y tarda 2-4 minutos).
      </p>
      <div className="filters">
        <button type="button" onClick={() => void reanalyze()} disabled={isPending || running}>
          {running ? "Reanalizando…" : stale ? "Reanalizar (el PDF cambió)" : "Reanalizar con IA"}
        </button>
        {stale && !running && (
          <span className="badge warn">el PDF es más nuevo que el análisis</span>
        )}
        {job && (
          <span
            className={`badge ${job.status === "error" ? "ko" : job.status === "done" ? "ok" : "warn"}`}
          >
            {job.status === "queued"
              ? "en cola"
              : job.status === "running"
                ? "procesando"
                : job.status === "done"
                  ? "completado"
                  : "error"}
          </span>
        )}
      </div>
      {job && job.lines.length > 0 && (
        <pre
          className="mono small"
          style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", marginTop: 8 }}
        >
          {job.lines.slice(-12).join("\n")}
        </pre>
      )}
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
