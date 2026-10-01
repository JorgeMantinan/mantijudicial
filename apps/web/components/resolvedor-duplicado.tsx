"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Para un grupo de duplicados: eliges cuál te quedas y archiva el resto
 * (archivar solo lo oculta; no borra nada).
 */
export function ResolvedorDuplicado({ casos }: { casos: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mantener, setMantener] = useState(casos[0] ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar() {
    setError(null);
    setMsg(null);
    let archivados = 0;
    for (const caseId of casos) {
      if (caseId === mantener) continue;
      const response = await fetch("/api/archivar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, archived: true }),
      }).catch(() => null);
      if (response?.ok) archivados += 1;
    }
    if (archivados === 0) {
      setError("No se pudo archivar ninguno (¿permisos?)");
      return;
    }
    setMsg(`Te quedas con ${mantener} · archivados ${archivados} ✓`);
    startTransition(() => router.refresh());
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <select
        value={mantener}
        onChange={(event) => setMantener(event.target.value)}
        aria-label="Caso que te quedas"
        style={{ fontSize: 13 }}
      >
        {casos.map((caseId) => (
          <option key={caseId} value={caseId}>
            Quedarme {caseId.replace("case_", "")}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void ejecutar()} disabled={isPending} style={{ fontSize: 13 }}>
        {isPending ? "Archivando…" : "Archivar el resto"}
      </button>
      {msg && <span className="badge ok">{msg}</span>}
      {error && (
        <span className="small" style={{ color: "var(--red)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
