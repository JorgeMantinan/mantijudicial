"use client";

import { useEffect, useState } from "react";

type Densidad = "normal" | "compacta";

function aplicar(densidad: Densidad): void {
  if (densidad === "compacta") document.documentElement.setAttribute("data-densidad", "compacta");
  else document.documentElement.removeAttribute("data-densidad");
}

/** Cambia la densidad de TODAS las tablas (se guarda en el navegador). */
export function DensityToggle() {
  const [densidad, setDensidad] = useState<Densidad>("normal");

  useEffect(() => {
    const guardado = window.localStorage.getItem("mj-densidad");
    if (guardado === "compacta" || guardado === "normal") {
      setDensidad(guardado);
      aplicar(guardado);
    }
  }, []);

  function alternar() {
    const siguiente: Densidad = densidad === "compacta" ? "normal" : "compacta";
    setDensidad(siguiente);
    aplicar(siguiente);
    window.localStorage.setItem("mj-densidad", siguiente);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title="Más filas por pantalla o filas más cómodas"
      aria-label="Cambiar densidad de las tablas"
      style={{ fontSize: 13 }}
    >
      {densidad === "compacta" ? "Cómodo" : "Compacto"}
    </button>
  );
}
