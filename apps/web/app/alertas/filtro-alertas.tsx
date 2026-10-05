"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const TIPOS: Array<{ valor: string; texto: string }> = [
  { valor: "", texto: "Todo" },
  { valor: "leyes", texto: "Leyes cambiadas" },
  { valor: "dividido", texto: "Criterio dividido" },
  { valor: "calidad", texto: "PDFs con problemas" },
  { valor: "revision", texto: "Sin revisar" },
  { valor: "frios", texto: "Casos fríos" },
  { valor: "nuevos", texto: "Nuevos en tus búsquedas" },
  { valor: "emergentes", texto: "Patrones emergentes" },
  { valor: "duplicados", texto: "Duplicados" },
];

const COINCIDENCIAS: Record<string, string[]> = {
  leyes: ["leyes cambiadas"],
  dividido: ["criterio dividido"],
  calidad: ["pdfs con problemas"],
  revision: ["pendientes de revisión"],
  frios: ["casos fríos"],
  nuevos: ["casos nuevos que encajan"],
  emergentes: ["patrones emergentes"],
  duplicados: ["posibles duplicados"],
};

/** Oculta/muestra las secciones de /alertas según el tipo elegido. */
export function FiltroAlertas() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(searchParams.get("tipo") ?? "");

  function cambiar(nuevo: string) {
    setValor(nuevo);
    const params = new URLSearchParams(searchParams.toString());
    if (nuevo) params.set("tipo", nuevo);
    else params.delete("tipo");
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`);

    const secciones = Array.from(document.querySelectorAll<HTMLElement>("main .section"));
    const titulos = COINCIDENCIAS[nuevo];
    for (const seccion of secciones) {
      if (!nuevo) {
        seccion.style.display = "";
        continue;
      }
      const titulo = (seccion.querySelector("h2")?.textContent ?? "").toLowerCase();
      seccion.style.display = titulos.some((frase) => titulo.includes(frase)) ? "" : "none";
    }
  }

  return (
    <label className="small muted" style={{ display: "grid", gap: 4, minWidth: 240 }}>
      Ver solo
      <select value={valor} onChange={(event) => cambiar(event.target.value)}>
        {TIPOS.map((tipo) => (
          <option key={tipo.valor} value={tipo.valor}>
            {tipo.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
