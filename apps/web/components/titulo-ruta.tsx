"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const REGLAS: Array<[RegExp, string]> = [
  [/^\/$/, "Resumen"],
  [/^\/cases\/case_\d{6}\/compare\//, "Informe comparativo"],
  [/^\/cases\/case_\d{6}\/dossier/, "Dossier del cliente"],
  [/^\/cases\/case_\d{6}\/print/, "Ficha imprimible"],
  [/^\/cases\/case_\d{6}\/\w/, "Caso"],
  [/^\/cases$/, "Casos"],
  [/^\/review$/, "Revisión"],
  [/^\/alertas$/, "Alertas"],
  [/^\/informes$/, "Informes"],
  [/^\/plazos$/, "Plazos"],
  [/^\/evolucion$/, "Evolución"],
  [/^\/search$/, "Búsqueda"],
  [/^\/laws\/[\w-]+/, "Legislación"],
  [/^\/laws$/, "Legislación"],
  [/^\/patterns$/, "Patrones"],
  [/^\/eval$/, "Evaluación"],
  [/^\/ayuda$/, "Ayuda"],
  [/^\/novedades$/, "Novedades"],
  [/^\/resumen$/, "Resumen del día"],
  [/^\/users$/, "Usuarios"],
  [/^\/login$/, "Entrar"],
  [/^\/temas\/comparar/, "Comparar temas"],
  [/^\/temas\//, "Tema"],
];

/** Título de la pestaña según la ruta (se aplica al cargar la página). */
export function TituloRuta() {
  const pathname = usePathname();

  useEffect(() => {
    const regla = REGLAS.find(([patron]) => patron.test(pathname ?? ""));
    if (regla) document.title = `${regla[1]} · MantiJudicial`;
  }, [pathname]);

  return null;
}
