"use client";

import { pedirOpcional, pedir } from "@/lib/api-client";

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

interface Resultado {
  name: string;
  caseId: string | null;
  error: string | null;
}

export function IngestForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobState | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function waitForJob(jobId: string): Promise<JobState> {
    return new Promise((resolve) => {
      const tick = async () => {
        const payload = await pedirOpcional<{ jobs: JobState[] }>("/api/ingest", { cache: "no-store" });
        const current = payload?.jobs.find((item) => item.id === jobId);
        if (!current) return;
        setJob(current);
        if (current.status === "done" || current.status === "error") {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          resolve(current);
        }
      };
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => void tick(), 1500);
      void tick();
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setJob(null);
    setResultados([]);
    setProgreso(null);

    const form = new FormData(event.currentTarget);
    const files = form
      .getAll("file")
      .filter((item): item is File => item instanceof File && item.size > 0);
    const source = String(form.get("source") ?? "");

    if (files.length === 0) {
      setError("Elige al menos un PDF");
      return;
    }

    let completados = 0;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      setProgreso(`${index + 1}/${files.length} · ${file.name}`);

      const data = new FormData();
      data.set("file", file);
      if (source) data.set("source", source);

      let payload: { jobId?: string };
      try {
        payload = await pedir("/api/ingest", { method: "POST", body: data }, "No se pudo iniciar la ingesta");
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : "No se pudo iniciar la ingesta";
        setResultados((prev) => [...prev, { name: file.name, caseId: null, error: mensaje }]);
        continue;
      }
      if (!payload.jobId) {
        setResultados((prev) => [...prev, { name: file.name, caseId: null, error: "No se pudo iniciar la ingesta" }]);
        continue;
      }
  
      setJob({ id: payload.jobId, status: "queued", caseId: null, lines: [], error: null });
      const final = await waitForJob(payload.jobId);
      setResultados((prev) => [
        ...prev,
        {
          name: file.name,
          caseId: final.status === "done" ? (final.caseId ?? null) : null,
          error: final.status === "error" ? (final.error ?? "La ingesta falló") : null,
        },
      ]);
      if (final.status === "done") completados += 1;
    }

    setProgreso(null);
    setJob(null);
    if (completados > 0) startTransition(() => router.refresh());
  }

  const running = progreso !== null || (job !== null && job.status !== "done" && job.status !== "error");
  const okCount = resultados.filter((item) => item.caseId).length;

  return (
    <div>
      <form ref={formRef} onSubmit={submit} className="filters">
        <input type="file" name="file" accept="application/pdf" multiple required />
        <input name="source" placeholder="origen (despacho, cliente…)" maxLength={60} />
        <button type="submit" disabled={isPending || running}>
          {running ? "Procesando…" : "Subir y analizar"}
        </button>
      </form>
      <p className="small muted">
        Puedes elegir varios PDF a la vez: se suben y analizan uno a uno (cada uno tarda unos
        minutos por el paso de IA).
      </p>

      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {progreso && (
        <p className="small">
          <span className="badge warn">en curso</span> {progreso}
        </p>
      )}

      {resultados.length > 0 && (
        <div className="section" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 8 }}>
            Resultado de la subida ·{" "}
            <span className={`badge ${okCount === resultados.length ? "ok" : "warn"}`}>
              {okCount}/{resultados.length} correctos
            </span>
          </h3>
          <table>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((item) => (
                <tr key={item.name}>
                  <td className="small mono">{item.name}</td>
                  <td className="small">
                    {item.error ? (
                      <span style={{ color: "var(--red)" }}>{item.error}</span>
                    ) : item.caseId ? (
                      <Link href={`/cases/${item.caseId}`}>caso creado: {item.caseId} →</Link>
                    ) : (
                      <span>Sin identificador</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resultados.length > 0 && !running && (
        <p className="small" style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              formRef.current?.reset();
              setResultados([]);
              setError(null);
              setJob(null);
            }}
          >
            Subir otro PDF
          </button>
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
        </div>
      )}
    </div>
  );
}
