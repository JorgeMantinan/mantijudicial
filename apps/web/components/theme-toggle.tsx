"use client";

import { useEffect, useState } from "react";

type Tema = "dark" | "light";

function aplicar(tema: Tema): void {
  if (tema === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    const guardado = window.localStorage.getItem("mj-tema");
    if (guardado === "light" || guardado === "dark") {
      setTema(guardado);
      aplicar(guardado);
    }
  }, []);

  function alternar() {
    const siguiente: Tema = tema === "dark" ? "light" : "dark";
    setTema(siguiente);
    aplicar(siguiente);
    window.localStorage.setItem("mj-tema", siguiente);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      title="Cambiar entre tema claro y oscuro"
      aria-label="Cambiar tema claro/oscuro"
      style={{ fontSize: 13 }}
    >
      {tema === "dark" ? "Claro" : "Oscuro"}
    </button>
  );
}
