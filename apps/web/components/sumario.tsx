"use client";

import { useEffect, useState } from "react";

/**
 * Sumario de la hoja imprimible: numera los <h2> del artículo y lista sus
 * títulos con enlaces. Como actúa en el cliente, en el PDF sale incluido.
 */
export function Sumario() {
  const [items, setItems] = useState<Array<{ id: string; texto: string }>>([]);

  useEffect(() => {
    const raiz = document.querySelector("article.print-sheet");
    if (!raiz) return;
    const titulos = Array.from(raiz.querySelectorAll("h2"));
    const lista = titulos.map((titulo, index) => {
      const id = `hoja-${index + 1}`;
      titulo.id = id;
      return { id, texto: (titulo.textContent ?? "").trim() };
    });
    setItems(lista);
  }, []);

  if (items.length < 2) return null;

  return (
    <nav
      aria-label="Sumario"
      style={{
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: "8px 14px",
        margin: "12px 0",
      }}
    >
      <strong className="small">Sumario</strong>
      <ol className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`}>{item.texto}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
