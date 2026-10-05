"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Conmutador "versión interna" del dossier (sustituye al enlace). */
export function InternoToggle({ caseId, interno }: { caseId: string; interno: boolean }) {
  const router = useRouter();
  const [activado, setActivado] = useState(interno);

  function cambiar(checked: boolean) {
    setActivado(checked);
    router.replace(`/cases/${caseId}/dossier${checked ? "?interno=1" : ""}`);
  }

  return (
    <label
      className="small"
      style={{ display: "inline-flex", gap: 6, alignItems: "center", cursor: "pointer" }}
    >
      <input type="checkbox" checked={activado} onChange={(event) => cambiar(event.target.checked)} />
      Versión interna (huecos, comprobaciones y argumentos no aceptados)
    </label>
  );
}
