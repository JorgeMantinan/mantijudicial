"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CLAVE = "mj_historial_busquedas";

/** Últimas consultas hechas (localStorage, sin subirlas a ningún sitio). */
export function HistorialBusquedas({ query }: { query: string }) {
  const [historial, setHistorial] = useState<string[]>([]);

  useEffect(() => {
    let guardado: string[] = [];
    try {
      guardado = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]") as string[];
    } catch {
      guardado = [];
    }
    const limpio = query.trim();
    if (limpio.length >= 3) {
      const siguiente = [limpio, ...guardado.filter((item) => item !== limpio)].slice(0, 8);
      try {
        window.localStorage.setItem(CLAVE, JSON.stringify(siguiente));
      } catch {
        // almacenamiento lleno o bloqueado: seguimos sin guardar
      }
      setHistorial(siguiente);
    } else {
      setHistorial(guardado);
    }
  }, [query]);

  if (historial.length === 0) return null;

  return (
    <p className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span className="muted">Últimas búsquedas:</span>
      {historial
        .filter((item) => item !== query)
        .slice(0, 6)
        .map((item) => (
          <Link key={item} href={`/search?q=${encodeURIComponent(item)}`} className="badge">
            {item.length > 24 ? `${item.slice(0, 24)}…` : item}
          </Link>
        ))}
    </p>
  );
}
