"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Asigna el cliente/encargo del caso (data/casos_cliente.json). */
export function ClientePanel({ caseId, cliente }: { caseId: string; cliente: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [valor, setValor] = useState(cliente);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setMsg(null);
    const response = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId, cliente: valor }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? "No se pudo guardar");
      return;
    }
    setMsg("Guardado ✓");
    startTransition(() => router.refresh());
    setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div className="filters" style={{ marginTop: 6 }}>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Cliente o encargo
        <input
          value={valor}
          onChange={(event) => setValor(event.target.value)}
          placeholder="p. ej. Ibercaja / Cláusula suelo familia D. Luisa"
          maxLength={80}
          style={{ minWidth: 280 }}
        />
      </label>
      <button type="button" onClick={() => void guardar()} disabled={isPending} style={{ marginTop: 18 }}>
        {isPending ? "Guardando…" : "Guardar"}
      </button>
      {msg && <span className="badge ok">{msg}</span>}
      {error && (
        <span className="small" style={{ color: "var(--red)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
