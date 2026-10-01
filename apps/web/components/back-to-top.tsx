"use client";

import { useEffect, useState } from "react";

/** Flecha "volver arriba" en páginas largas (no sale en papel). */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="no-print"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      title="Volver arriba"
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 19, fontSize: 16 }}
    >
      ↑
    </button>
  );
}
