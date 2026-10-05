"use client";

import { pedir } from "@/lib/api-client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRANCH, OUTCOME, REVIEW, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export interface ReviewRow {
  id: string;
  headline: string;
  branch: string;
  outcome: string;
  reviewStatus: string;
}

export function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);
  const [status, setStatus] = useState("REVIEWED");
  const [revisor, setRevisor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("caso");
  const [dirSort, setDirSort] = useState<"asc" | "desc">("asc");

  function ordenar(key: string) {
    if (key === sortKey) setDirSort((valor) => (valor === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDirSort("asc");
    }
  }

  const campo = (fila: ReviewRow): string =>
    sortKey === "asunto"
      ? fila.headline
      : sortKey === "rama"
        ? fila.branch
        : sortKey === "resultado"
          ? fila.outcome
          : sortKey === "revision"
            ? fila.reviewStatus
            : fila.id;
  const factor = dirSort === "desc" ? -1 : 1;
  const ordenadas = [...rows].sort((a, b) => campo(a).localeCompare(campo(b), "es") * factor);

  function ThOrden({ k, children }: { k: string; children: React.ReactNode }) {
    return (
      <th>
        <button
          type="button"
          onClick={() => ordenar(k)}
          aria-label={`Ordenar por ${k}`}
          style={{
            background: "none",
            border: "none",
            color: "inherit",
            cursor: "pointer",
            font: "inherit",
            padding: 0,
          }}
        >
          {children}
          {sortKey === k ? (dirSort === "asc" ? " ▲" : " ▼") : " ⇅"}
        </button>
      </th>
    );
  }

  const todos = rows.length > 0 && sel.length === rows.length;

  function toggle(id: string) {
    setSel((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function aplicar() {
    if (sel.length === 0) {
      setError("Marca al menos un caso");
      return;
    }
    if (!revisor.trim()) {
      setError("Escribe quién revisa");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    let ok = 0;
    for (const caseId of sel) {
      try {
        await pedir("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, status, reviewedBy: revisor.trim(), notes: "" }),
        });
        ok += 1;
      } catch {
        /* caso no contado: sin permisos o red caída */
      }
    }
    setBusy(false);
    setMsg(`${ok}/${sel.length} casos guardados`);
    setSel([]);
    router.refresh();
  }

  return (
    <div>
      <div className="filters no-print">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Marcar como
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {Object.entries(REVIEW)
              .filter(([value]) => value !== "UNREVIEWED")
              .map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Revisado por
          <input
            value={revisor}
            onChange={(event) => setRevisor(event.target.value)}
            placeholder="nombre o correo"
          />
        </label>
        <button type="button" onClick={() => void aplicar()} disabled={busy || sel.length === 0}>
          {busy ? `Guardando…` : `Aplicar a ${sel.length} seleccionados`}
        </button>
        {msg && <span className="badge ok">{msg}</span>}
      </div>
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>
              <input
                type="checkbox"
                checked={todos}
                onChange={() => setSel(todos ? [] : rows.map((row) => row.id))}
                aria-label="Seleccionar todos"
              />
            </th>
            <ThOrden k="caso">Caso</ThOrden>
            <ThOrden k="asunto">Asunto</ThOrden>
            <ThOrden k="rama">Rama</ThOrden>
            <ThOrden k="resultado">Resultado</ThOrden>
            <ThOrden k="revision">Revisión</ThOrden>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((item) => (
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={sel.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  aria-label={`Seleccionar ${item.id}`}
                />
              </td>
              <td className="mono">{item.id.replace("case_", "")}</td>
              <td>{item.headline}</td>
              <td className="small">{label(BRANCH, item.branch)}</td>
              <td>
                <OutcomeBadge outcome={item.outcome} />
              </td>
              <td>
                <span
                  className={`badge ${item.reviewStatus === "UNREVIEWED" ? "warn" : item.reviewStatus === "REJECTED" ? "ko" : "ok"}`}
                  title={item.reviewStatus}
                >
                  {label(REVIEW, item.reviewStatus)}
                </span>
              </td>
              <td>
                <Link href={`/cases/${item.id}`}>abrir →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
