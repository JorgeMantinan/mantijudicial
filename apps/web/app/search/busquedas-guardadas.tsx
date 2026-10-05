"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BusquedaGuardada } from "@/lib/dataset";

function hrefDe(item: BusquedaGuardada): string {
  const params = new URLSearchParams();
  params.set("q", item.q);
  if (item.kind) params.set("kind", item.kind);
  if (item.branch) params.set("branch", item.branch);
  if (item.outcome) params.set("outcome", item.outcome);
  return `/search?${params.toString()}`;
}

export function BusquedasGuardadas({
  items,
  q,
  kind,
  branch,
  outcome,
}: {
  items: BusquedaGuardada[];
  q: string;
  kind: string;
  branch: string;
  outcome: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [lista, setLista] = useState(items);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setError(null);
    setMsg(null);
    const response = await fetch("/api/busquedas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), q, kind, branch, outcome }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? "No se pudo guardar");
      return;
    }
    const payload = (await response.json()) as { busquedas?: BusquedaGuardada[] };
    setLista(payload.busquedas ?? []);
    setNombre("");
    setMsg("Guardada");
    startTransitionDone();
  }

  function startTransitionDone() {
    setTimeout(() => setMsg(null), 2500);
  }

  async function borrar(nombreItem: string) {
    setError(null);
    const response = await fetch("/api/busquedas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreItem }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("No se pudo borrar");
      return;
    }
    const payload = (await response.json()) as { busquedas?: BusquedaGuardada[] };
    setLista(payload.busquedas ?? []);
    router.refresh();
  }

  const nombreLimpio = nombre.trim();
  const yaExiste = nombreLimpio.length > 0 && lista.some((item) => item.nombre === nombreLimpio);

  return (
    <div style={{ marginTop: 4 }}>
      <div className="filters" style={{ marginTop: 8 }}>
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Nombre para guardar esta búsqueda"
          style={{ minWidth: 240 }}
        />
        <button type="button" onClick={() => void guardar()} disabled={!q || !nombre.trim()}>
          {yaExiste ? "Actualizar búsqueda" : "Guardar búsqueda"}
        </button>
        {msg && <span className="badge ok">{msg}</span>}
        {yaExiste && <span className="small muted">ya existe ese nombre: se actualizará</span>}
      </div>
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      {lista.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {lista.map((item) => (
            <span
              key={item.nombre}
              className="badge"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <Link href={hrefDe(item)}>{item.nombre}</Link>
              <button
                type="button"
                onClick={() => void borrar(item.nombre)}
                aria-label={`Borrar ${item.nombre}`}
                title="Borrar"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 12,
                }}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
