"use client";

import { pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const ROLES = [
  { value: "LAWYER", label: "Abogado/a" },
  { value: "ORG_ADMIN", label: "Administración" },
  { value: "PARALEGAL", label: "Auxiliar" },
  { value: "VIEWER", label: "Solo lectura" },
];

export function UserForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("LAWYER");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCreated(null);
    let payload: { user?: { email: string } };
    try {
      payload = await pedir(
        "/api/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, password, role }),
        },
        "No se pudo crear el usuario",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo crear el usuario");
      return;
    }
    setCreated(payload.user?.email ?? "Usuario creado");
    setEmail("");
    setName("");
    setPassword("");
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="filters" style={{ alignItems: "flex-end" }}>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Nombre
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ana López"
          required
        />
      </label>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Correo
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ana@despacho.es"
          required
        />
      </label>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Contraseña (mín. 8)
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="small muted" style={{ display: "grid", gap: 4 }}>
        Rol
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          {ROLES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "Creando…" : "Crear usuario"}
      </button>
      {error && (
        <p className="small" style={{ color: "var(--red)", margin: 0 }}>
          {error}
        </p>
      )}
      {created && (
        <p className="small" style={{ color: "var(--green)", margin: 0 }}>
          Creado: {created}
        </p>
      )}
    </form>
  );
}
