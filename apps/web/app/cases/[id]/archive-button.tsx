"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ArchiveButton({
  caseId,
  archived,
  canArchive,
}: {
  caseId: string;
  archived: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canArchive) return null;

  async function toggle() {
    setError(null);
    const response = await fetch("/api/archivar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, archived: !archived }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? "No se pudo cambiar el estado");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <>
      <button type="button" onClick={() => void toggle()} disabled={isPending}>
        {isPending ? "…" : archived ? "Restaurar del archivo" : "Archivar"}
      </button>
      {error && (
        <span className="small" style={{ color: "var(--red)" }}>
          {" "}
          {error}
        </span>
      )}
    </>
  );
}
