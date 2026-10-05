"use client";

import { pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setError(null);
    try {
      await pedir("/api/auth/logout", { method: "POST" }, "No se pudo cerrar la sesión");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo cerrar la sesión");
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
