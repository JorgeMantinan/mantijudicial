"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    if (!response) {
      setError("No se pudo contactar con el servidor");
      return;
    }
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(payload.error ?? "Error al iniciar sesión");
      return;
    }
    const next = params.get("next");
    startTransition(() => router.push(next && next.startsWith("/") ? next : "/"));
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <label className="auth-field">
        Correo
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="username"
          placeholder="tu@correo.com"
          required
        />
      </label>
      <label className="auth-field">
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
