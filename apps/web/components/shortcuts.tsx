"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Atajos globales: / búsqueda, a alertas, i informes, r revisión, h ayuda.
 * No actúan mientras escribes en un campo.
 */
export function Shortcuts() {
  const router = useRouter();
  const [ayuda, setAyuda] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "/" ) {
        event.preventDefault();
        router.push("/search");
      } else if (key === "a") {
        router.push("/alertas");
      } else if (key === "c") {
        router.push("/cases");
      } else if (key === "l") {
        router.push("/laws");
      } else if (key === "i") {
        router.push("/informes");
      } else if (key === "r") {
        router.push("/review");
      } else if (key === "?" || key === "h") {
        event.preventDefault();
        setAyuda((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!ayuda) return null;

  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        background: "var(--panel)",
        border: "1px solid " + "var(--line)",
        borderRadius: 8,
        padding: "12px 16px",
        zIndex: 20,
        boxShadow: "0 6px 24px rgba(0,0,0,.35)",
      }}
    >
      <p style={{ margin: "0 0 6px", fontWeight: 700 }}>Atajos de teclado</p>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>
          <strong>/</strong> búsqueda
        </li>
        <li>
          <strong>a</strong> alertas
        </li>
        <li>
          <strong>c</strong> casos
        </li>
        <li>
          <strong>l</strong> legislación
        </li>
        <li>
          <strong>i</strong> informes
        </li>
        <li>
          <strong>r</strong> revisión
        </li>
        <li>
          <strong>N</strong> siguiente pendiente (en una ficha con revisión)
        </li>
        <li>
          <strong>?</strong> abrir/cerrar esta ayuda
        </li>
      </ul>
      <p className="small muted" style={{ margin: "6px 0 0" }}>
        No actúan mientras escribes en un campo.
      </p>
    </div>
  );
}
