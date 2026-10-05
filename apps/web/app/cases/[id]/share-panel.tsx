"use client";

import { pedir } from "@/lib/api-client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ACTION, label } from "@/lib/labels";

export interface ShareGrantView {
  id: string;
  grantee: string;
  granteeUserId: string | null;
  actions: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

const ACTIONS = ["VIEW", "ANALYZE", "DOWNLOAD", "EDIT", "SHARE", "EXPORT"];

export function SharePanel({
  caseId,
  canShare,
  users,
  currentUserId,
  grants,
}: {
  caseId: string;
  canShare: boolean;
  users: Array<{ id: string; name: string; email: string }>;
  currentUserId: string;
  grants: ShareGrantView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [grantee, setGrantee] = useState(users[0]?.id ?? "");
  const [actions, setActions] = useState<string[]>(["VIEW"]);
  const [error, setError] = useState<string | null>(null);
  const active = grants.filter((grant) => !grant.revokedAt);

  function toggle(action: string) {
    setActions((current) =>
      current.includes(action)
        ? current.filter((item) => item !== action)
        : [...current, action],
    );
  }

  async function share(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await pedir(
        "/api/grants",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: caseId, granteeUserId: grantee, actions }),
        },
        "No se pudo compartir",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo compartir");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function revoke(grantId: string) {
    setError(null);
    try {
      await pedir(
        "/api/grants/revoke",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grantId }),
        },
        "No se pudo revocar",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo revocar");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="section">
      <h2>Compartir caso</h2>
      <p className="small muted">
        La revocación es inmediata: la búsqueda, la ficha y el retrieval de IA dejan de incluir el
        caso. Queda registrada en <span className="mono">data/audit.log</span>.
      </p>

      {active.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Concedido a</th>
              <th>Permisos</th>
              <th>Desde</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {active.map((grant) => (
              <tr key={grant.id}>
                <td className="small">{grant.grantee}</td>
                <td className="small">{grant.actions.map((action) => label(ACTION, action)).join(", ")}</td>
                <td className="small">{grant.createdAt.slice(0, 10)}</td>
                <td>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => void revoke(grant.id)}
                      disabled={isPending}
                      style={{ background: "transparent", color: "var(--red)", border: "1px solid var(--line)", fontSize: 12, padding: "3px 8px" }}
                    >
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canShare ? (
        <form onSubmit={share} className="filters" style={{ marginTop: 12 }}>
          <label className="small muted" style={{ display: "grid", gap: 4 }}>
            Destinatario
            <select value={grantee} onChange={(event) => setGrantee(event.target.value)}>
              {users
                .filter((user) => user.id !== currentUserId)
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
            </select>
          </label>
          <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ACTIONS.map((action) => (
              <label key={action} className="small" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={actions.includes(action)}
                  onChange={() => toggle(action)}
                />
                {label(ACTION, action)}
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={isPending || !grantee || actions.length === 0}>
            {isPending ? "Compartiendo…" : "Compartir"}
          </button>
        </form>
      ) : (
        <p className="small muted">Solo el propietario o la administración del despacho puede compartir.</p>
      )}

      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
