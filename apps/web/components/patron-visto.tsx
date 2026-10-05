"use client";

import { pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Marca un patrón emergente como visto (deja de salir en /alertas). */
export function MarcarVistoButton({ ejemplo }: { ejemplo: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hecho, setHecho] = useState(false);

  async function marcar() {
    try {
      await pedir("/api/patrones-vistos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ejemplo }),
      });
    } catch {
      return;
    }
    setHecho(true);
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={() => void marcar()}
      disabled={isPending || hecho}
      style={{ fontSize: 12, marginLeft: 6 }}
    >
      {hecho ? "Visto ✓" : isPending ? "…" : "Ya lo he visto"}
    </button>
  );
}

/** Restaura los patrones ocultos. */
export function RestaurarPatronesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function restaurar() {
    try {
      await pedir("/api/patrones-vistos", { method: "DELETE" });
    } catch {
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <button type="button" onClick={() => void restaurar()} disabled={isPending} style={{ fontSize: 12 }}>
      {isPending ? "…" : "Restaurar los ocultos"}
    </button>
  );
}
