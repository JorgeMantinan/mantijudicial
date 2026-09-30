"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

type Status = { enabled: boolean };

export function MfaPanel() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(false);
  const [phase, setPhase] = useState<"idle" | "setup" | "done">("idle");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status" }),
    }).catch(() => null);
    if (!response?.ok) return;
    const payload = (await response.json().catch(() => ({}))) as Status;
    setEnabled(Boolean(payload.enabled));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function call(action: "setup" | "verify" | "disable") {
    setMessage(null);
    const response = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code }),
    }).catch(() => null);
    if (!response) {
      setMessage("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      enabled?: boolean;
      secret?: string;
      uri?: string;
    };
    if (!response.ok) {
      setMessage(payload.error ?? "Error");
      return;
    }
    if (action === "setup" && payload.secret && payload.uri) {
      setSecret(payload.secret);
      setUri(payload.uri);
      setPhase("setup");
      return;
    }
    setEnabled(Boolean(payload.enabled));
    setPhase(payload.enabled ? "done" : "idle");
    setCode("");
    setMessage(
      action === "verify"
        ? "Doble factor activado: a partir de ahora la entrada pedirá un código."
        : action === "disable"
          ? "Doble factor desactivado y sesiones cerradas."
          : null,
    );
    startTransition(() => router.refresh());
  }

  return (
    <div className="section">
      <h2>Doble factor (TOTP)</h2>
      <p className="small muted">
        Añade una segunda barrera a la contraseña con cualquier app de autenticación (Google
        Authenticator, Aegis, 1Password…). Opcional, pero recomendable.
      </p>

      {enabled ? (
        <div className="filters">
          <span className="badge ok">activo</span>
          <label className="small muted" style={{ display: "grid", gap: 4 }}>
            Código de 6 dígitos para desactivar
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} />
          </label>
          <button type="button" onClick={() => void call("disable")} disabled={isPending || code.length !== 6}>
            {isPending ? "Procesando…" : "Desactivar"}
          </button>
        </div>
      ) : phase === "setup" ? (
        <div>
          <p className="small muted">
            Escanea o introduce este secreto en tu app:
          </p>
          <p className="mono small" style={{ wordBreak: "break-all", background: "var(--panel-2)", padding: 10, borderRadius: 8 }}>
            {uri}
          </p>
          <p className="mono small" style={{ background: "var(--panel-2)", padding: 10, borderRadius: 8 }}>
            Secreto: {secret}
          </p>
          <div className="filters">
            <label className="small muted" style={{ display: "grid", gap: 4 }}>
              Código mostrado por la app
              <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} />
            </label>
            <button type="button" onClick={() => void call("verify")} disabled={isPending || code.length !== 6}>
              {isPending ? "Comprobando…" : "Confirmar activación"}
            </button>
          </div>
        </div>
      ) : (
        <div className="filters">
          <button type="button" onClick={() => void call("setup")} disabled={isPending}>
            Activar doble factor
          </button>
        </div>
      )}

      {message && (
        <p className="small" style={{ color: "var(--green)" }}>
          {message}
        </p>
      )}
    </div>
  );
}
