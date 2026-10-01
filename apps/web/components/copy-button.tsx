"use client";

import { useState } from "react";

/**
 * Copia al portapapeles un texto (o la URL absoluta de una ruta interna).
 * Muestra "Copiado" unos segundos como confirmación.
 */
export function CopyButton({
  texto,
  path,
  etiqueta = "Copiar",
}: {
  texto?: string;
  path?: string;
  etiqueta?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(false);

  async function copiar() {
    setError(false);
    const valor = texto ?? (path ? window.location.origin + path : "");
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError(true);
    }
  }

  return (
    <button type="button" onClick={() => void copiar()} style={{ fontSize: 13 }}>
      {copiado ? "Copiado ✓" : error ? "No se pudo copiar" : etiqueta}
    </button>
  );
}
