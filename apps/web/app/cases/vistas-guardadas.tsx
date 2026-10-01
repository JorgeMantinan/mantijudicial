"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { VistaGuardada } from "@/lib/dataset";

function hrefDe(vista: VistaGuardada): string {
  const params = new URLSearchParams(vista.qs);
  const qs = params.toString();
  return `/cases${qs ? `?${qs}` : ""}`;
}

/** Guarda la combinación actual de filtros de /cases y la reutiliza. */
export function VistasGuardadas({
  vistas,
  actuales,
}: {
  vistas: VistaGuardada[];
  actuales: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [lista, setLista] = useState(vistas);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hayFiltros = Object.values(actuales).some((valor) => Boolean(valor));

  async function guardar() {
    setError(null);
    setMsg(null);
    const response = await fetch("/api/vistas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombre.trim(), qs: actuales }),
    }).catch(() => null);
    if (!response?.ok) {
      const payload = (await response?.json().catch(() => ({}))) as { error?: string };
      setError(payload?.error ?? "No se pudo guardar");
      return;
    }
    const payload = (await response.json()) as { vistas?: VistaGuardada[] };
    setLista(payload.vistas ?? []);
    setNombre("");
    setMsg("Vista guardada ✓");
    setTimeout(() => setMsg(null), 2500);
  }

  async function borrar(vista: VistaGuardada) {
    setError(null);
    const response = await fetch("/api/vistas", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: vista.nombre }),
    }).catch(() => null);
    if (!response?.ok) {
      setError("No se pudo borrar");
      return;
    }
    const payload = (await response.json()) as { vistas?: VistaGuardada[] };
    setLista(payload.vistas ?? []);
    startTransition(() => router.refresh());
  }

  return (
    <div style={{ marginTop: 8 }}>
      {hayFiltros && (
        <div className="filters" style={{ marginTop: 8 }}>
          <input
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Nombre para guardar esta vista"
            style={{ minWidth: 220 }}
          />
          <button type="button" onClick={() => void guardar()} disabled={!nombre.trim()}>
            Guardar vista
          </button>
          {msg && <span className="badge ok">{msg}</span>}
        </div>
      )}
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      {lista.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          {lista.map((vista) => (
            <span
              key={vista.nombre}
              className="badge"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <Link href={hrefDe(vista)}>{vista.nombre}</Link>
              <button
                type="button"
                onClick={() => void borrar(vista)}
                aria-label={`Borrar vista ${vista.nombre}`}
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
