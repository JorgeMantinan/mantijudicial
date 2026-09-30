"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setError(null);
    const response = await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    if (!response || !response.ok) {
      setError("No se pudo cerrar la sesión");
      return;
    }
    startTransition(() => router.push("/login"));
  }

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      {error && <span className="small" style={{ color: "var(--red)" }}>{error}</span>}
      <button
        type="button"
        onClick={logout}
        disabled={isPending}
        style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--line)", padding: "4px 10px", fontSize: 13 }}
      >
        {isPending ? "Saliendo…" : "Salir"}
      </button>
    </span>
  );
}
