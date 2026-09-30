"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { REVIEW, label } from "@/lib/labels";

interface CurrentReview {
  status?: string;
  reviewed_by?: string | null;
  notes?: string;
}

export function ReviewForm({
  caseId,
  current,
}: {
  caseId: string;
  current: CurrentReview;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(current.status ?? "UNREVIEWED");
  const [reviewedBy, setReviewedBy] = useState(current.reviewed_by ?? "");
  const [notes, setNotes] = useState(current.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const response = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, status, reviewedBy, notes }),
    }).catch(() => null);
    if (!response) {
      setError("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Error al guardar la revisión");
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
      {error && <p className="small" style={{ color: "var(--red)" }}>{error}</p>}
      {saved && <p className="small" style={{ color: "var(--green)" }}>Guardado</p>}
    </form>
  );
}
