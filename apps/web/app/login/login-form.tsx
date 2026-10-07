"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorApi, pedir } from "@/lib/api-client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await pedir(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, code: mfaRequired ? code : undefined }),
        },
        "Error al iniciar sesión",
      );
    } catch (error) {
      const datos = error instanceof ErrorApi ? (error.payload as { mfaRequired?: boolean } | undefined) : undefined;
      if (datos?.mfaRequired) setMfaRequired(true);
      setError(error instanceof Error ? error.message : "Error al iniciar sesión");
      return;
    }
    setMfaRequired(false);
    const next = params.get("next");
    // Solo rutas del propio sitio: "//host" y "/\host" (el navegador trata la
    // barra invertida como barra) serían una redirección abierta a otro dominio.
    const rutaPropia =
      next !== null && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
    startTransition(() => router.push(rutaPropia && next ? next : "/"));
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <label className="auth-field">
        Correo
        <input
          type="email"
          autoFocus
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
      {mfaRequired && (
        <label className="auth-field">
          Código de doble factor
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
            autoFocus
          />
        </label>
      )}
      <button type="submit" disabled={isPending}>
        {isPending ? "Entrando…" : "Entrar"}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
