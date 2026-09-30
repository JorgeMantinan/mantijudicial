"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { JOB, label } from "@/lib/labels";

interface JobState {
  id: string;
  status: string;
  caseId: string | null;
  lines: string[];
  error: string | null;
}

export function IngestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function poll(jobId: string) {
    const response = await fetch("/api/ingest", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => ({ jobs: [] }))) as { jobs: JobState[] };
    const current = payload.jobs.find((item) => item.id === jobId);
    if (!current) return;
    setJob(current);
    if (current.status === "done" || current.status === "error") {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      if (current.status === "done") {
        setDone(true);
        startTransition(() => router.refresh());
      } else {
        setError(current.error ?? "La ingesta falló");
      }
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setJob(null);
    setDone(false);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/ingest", { method: "POST", body: form }).catch(() => null);
    if (!response) {
      setError("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string; jobId?: string };
    const jobId = payload.jobId;
    if (!response.ok || !jobId) {
      setError(payload.error ?? "No se pudo iniciar la ingesta");
      return;
    }
    setJob({ id: jobId, status: "queued", caseId: null, lines: [], error: null });
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => void poll(jobId), 1500);
  }

  const running = job !== null && job.status !== "done" && job.status !== "error";

  return (
    <div>
      <form onSubmit={submit} className="filters">
        <input type="file" name="file" accept="application/pdf" required />
        <input name="source" placeholder="origen (despacho, cliente…)" maxLength={60} />
        <button type="submit" disabled={isPending || running}>
          {running ? "Procesando…" : "Subir y analizar"}
        </button>
      </form>

      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {job && (
        <div className="section" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 8 }}>
            Trabajo {job.id} ·{" "}
            <span className={`badge ${job.status === "error" ? "ko" : job.status === "done" ? "ok" : "warn"}`}>
              {label(JOB, job.status)}
            </span>
          </h3>
          <pre className="mono small" style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto" }}>
            {job.lines.join("\n")}
          </pre>
          {done && job.caseId && (
            <p className="small">
              Caso creado: <Link href={`/cases/${job.caseId}`}>{job.caseId}</Link>
            </p>
          )}
          {running && (
            <p className="small muted">
              La extracción y el análisis con IA tardan unos minutos: la página se actualiza sola.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
