"use client";

import { pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { REVIEW } from "@/lib/labels";

interface CurrentReview {
  status?: string;
  reviewed_by?: string | null;
  notes?: string;
}

export function ReviewForm({
  caseId,
  current,
  nextId,
}: {
  caseId: string;
  current: CurrentReview;
  nextId?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(current.status ?? "UNREVIEWED");
  const [reviewedBy, setReviewedBy] = useState(current.reviewed_by ?? "");
  const [notes, setNotes] = useState(current.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!nextId) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (event.key.toLowerCase() === "n" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        router.push(`/cases/${nextId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await pedir(
        "/api/review",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, status, reviewedBy, notes }),
        },
        "Error al guardar la revisión",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al guardar la revisión");
      return;
    }
    setSaved(true);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="filters" style={{ alignItems: "flex-start" }}>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Estado
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {Object.entries(REVIEW).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Revisado por
        <input
          value={reviewedBy}
          onChange={(event) => setReviewedBy(event.target.value)}
          placeholder="nombre o correo"
          required={status !== "UNREVIEWED"}
        />
      </label>
      <label className="small muted" style={{ display: "grid", gap: 4, flex: 1, minWidth: 260 }}>
        Notas
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="qué se ha comprobado o corregido"
        />
      </label>
      <button type="submit" disabled={isPending} style={{ marginTop: 20 }}>
        {isPending ? "Guardando…" : "Guardar revisión"}
      </button>
      {saved && nextId && (
        <button type="button" style={{ marginTop: 20 }} onClick={() => router.push(`/cases/${nextId}`)}>
          Guardado ✓ · Siguiente pendiente (N) →
        </button>
      )}
      {error && <p className="small" style={{ color: "var(--red)" }}>{error}</p>}
      {saved && !nextId && <p className="small" style={{ color: "var(--green)" }}>Guardado</p>}
      {!saved && nextId && (
        <p className="small muted" style={{ marginTop: 24 }}>
          Atajo: pulsa <strong>N</strong> para abrir el siguiente pendiente.
        </p>
      )}
    </form>
  );
}
