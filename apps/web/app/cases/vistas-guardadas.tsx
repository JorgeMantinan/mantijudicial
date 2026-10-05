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
import { pedir } from "@/lib/api-client";
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
    let payload: { vistas?: VistaGuardada[] };
    try {
      payload = await pedir<{ vistas?: VistaGuardada[] }>(
        "/api/vistas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: nombre.trim(), qs: actuales }),
        },
        "No se pudo guardar",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar");
      return;
    }
    setLista(payload.vistas ?? []);
    setNombre("");
    setMsg("Vista guardada ✓");
    setTimeout(() => setMsg(null), 2500);
  }

  async function borrar(vista: VistaGuardada) {
    setError(null);
    let payload: { vistas?: VistaGuardada[] };
    try {
      payload = await pedir<{ vistas?: VistaGuardada[] }>(
        "/api/vistas",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: vista.nombre }),
        },
        "No se pudo borrar",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo borrar");
      return;
    }
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
