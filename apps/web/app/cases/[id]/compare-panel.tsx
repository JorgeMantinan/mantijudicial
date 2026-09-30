"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface Job {
  id: string;
  status: string;
  caseId: string | null;
  lines: string[];
  error: string | null;
}

export function ComparePanel({
  caseId,
  options,
  existing,
}: {
  caseId: string;
  options: Array<{ id: string; title: string }>;
  existing: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [other, setOther] = useState(
    options.find((item) => !existing.includes(item.id))?.id ?? options[0]?.id ?? "",
  );
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function poll(jobId: string) {
    const response = await fetch("/api/jobs", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => ({ jobs: [] }))) as { jobs: Job[] };
    const current = payload.jobs.find((item) => item.id === jobId);
    if (!current) return;
    setJob(current);
    if (current.status === "done" || current.status === "error") {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      if (current.status === "error") setError(current.error ?? "La comparación falló");
      startTransition(() => router.refresh());
    }
  }

  async function start() {
    if (!other) return;
    setError(null);
    setJob(null);
    const response = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, otherId: other }),
    }).catch(() => null);
    if (!response) {
      setError("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string; jobId?: string };
    const jobId = payload.jobId;
    if (!response.ok || !jobId) {
      setError(payload.error ?? "No se pudo iniciar la comparación");
      return;
    }
    setJob({ id: jobId, status: "queued", caseId, lines: [], error: null });
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => void poll(jobId), 2000);
  }

  const running = job !== null && job.status !== "done" && job.status !== "error";

  if (options.length === 0) {
    return (
      <p className="small muted">
        No hay otros casos comparables todavía. Por CLI:{" "}
        <span className="mono">pnpm compare -- --a={caseId}</span>
      </p>
    );
  }

  return (
    <div>
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Comparar con
          <select value={other} onChange={(event) => setOther(event.target.value)}>
            {options.map((item) => (
              <option key={item.id} value={item.id} disabled={existing.includes(item.id)}>
                {existing.includes(item.id) ? "✓ " : ""}
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={isPending || running || !other}>
          {running ? "Comparando…" : "Generar comparación"}
        </button>
        {job && (
          <span
            className={`badge ${job.status === "error" ? "ko" : job.status === "done" ? "ok" : "warn"}`}
          >
            {job.status === "queued" ? "en cola" : job.status === "running" ? "procesando" : job.status === "done" ? "completado" : "error"}
          </span>
        )}
      </form>
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      {job && job.lines.length > 0 && (
        <pre
          className="mono small"
          style={{ whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", marginTop: 8 }}
        >
          {job.lines.slice(-8).join("\n")}
        </pre>
      )}
    </div>
  );
}
