"use client";

import { useEffect, useState } from "react";

/** Filtra las secciones de /ayuda por texto (oculta las que no coinciden). */
export function FiltroAyuda() {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const secciones = Array.from(document.querySelectorAll<HTMLElement>("main .section"));
    const consulta = texto.trim().toLowerCase();
    for (const seccion of secciones) {
      if (consulta.length < 2) {
        seccion.style.display = "";
        continue;
      }
      const coincide = (seccion.textContent ?? "").toLowerCase().includes(consulta);
      seccion.style.display = coincide ? "" : "none";
    }
  }, [texto]);

  // Enlace profundo: /ayuda?seccion=MFA lleva a esa sección.
  useEffect(() => {
    const buscado = new URLSearchParams(window.location.search).get("seccion");
    if (!buscado) return;
    const objetivo = Array.from(
      document.querySelectorAll<HTMLElement>("main .section"),
    ).find((seccion) =>
      (seccion.querySelector("h2")?.textContent ?? "").toLowerCase().includes(buscado.toLowerCase()),
    );
    objetivo?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="filters no-print" style={{ marginTop: 8 }}>
      <input
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder="Buscar en la ayuda (atajos, clientes, CSV, MFA…)"
        aria-label="Buscar en la ayuda"
        style={{ minWidth: 300 }}
      />
      {texto && (
        <button type="button" onClick={() => setTexto("")}>
          Limpiar
        </button>
      )}
    </div>
  );
}
