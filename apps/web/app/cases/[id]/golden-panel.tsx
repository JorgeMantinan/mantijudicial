"use client";

import { pedir } from "@/lib/api-client";

import { useState, useTransition } from "react";
import { BRANCH, OUTCOME, label } from "@/lib/labels";

interface Evidence {
  pdf: {
    fallo: string;
    outcome: string;
    siglas: string[];
    boe_ids: string[];
    sin_texto: boolean;
  };
  ia: {
    outcome: string;
    branch: string;
    headline: string;
    holdings: number;
    facts: number;
    verified_boe_ids: string[];
  };
}

interface Entry {
  expect: {
    cassation_outcome?: string;
    civil_branch?: string;
    headline_contains?: string;
    must_cite_boe_ids?: string[];
    min_holdings?: number;
    min_facts?: number;
  };
  confirmed: boolean;
  source: string;
  notes?: string;
}

export function GoldenPanel({
  caseId,
  initialEntry,
  initialEvidence,
}: {
  caseId: string;
  initialEntry: Entry | null;
  initialEvidence: Evidence;
}) {
  const [isPending, startTransition] = useTransition();
  const [evidence] = useState<Evidence>(initialEvidence);
  const [entry, setEntry] = useState<Entry | null>(initialEntry);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [outcome, setOutcome] = useState(
    initialEntry?.expect.cassation_outcome ?? initialEvidence.pdf.outcome,
  );
  const [branch, setBranch] = useState(
    initialEntry?.expect.civil_branch ?? initialEvidence.ia.branch,
  );
  const [headline, setHeadline] = useState(initialEntry?.expect.headline_contains ?? "");
  const [norms, setNorms] = useState<string[]>(
    initialEntry?.expect.must_cite_boe_ids ?? initialEvidence.pdf.boe_ids,
  );
  const [holdings, setHoldings] = useState(
    initialEntry?.expect.min_holdings !== undefined ? String(initialEntry.expect.min_holdings) : "",
  );
  const [facts, setFacts] = useState(
    initialEntry?.expect.min_facts !== undefined ? String(initialEntry.expect.min_facts) : "",
  );

  async function submit(confirm: boolean) {
    setError(null);
    setSaved(false);
    const expect: Record<string, unknown> = {};
    if (outcome) expect.cassation_outcome = outcome;
    if (branch) expect.civil_branch = branch;
    if (headline.trim()) expect.headline_contains = headline.trim();
    if (norms.length > 0) expect.must_cite_boe_ids = norms;
    if (holdings) expect.min_holdings = Number(holdings);
    if (facts) expect.min_facts = Number(facts);

    let payload: { entry?: Entry };
    try {
      payload = await pedir(
        "/api/golden",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, confirm, expect }),
        },
        "No se pudo guardar",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar");
      return;
    }
    if (payload.entry) setEntry(payload.entry);
    setSaved(true);
    startTransition(() => undefined);
  }

  const coincide = evidence.pdf.outcome === evidence.ia.outcome;
  const enPdf = new Set(evidence.pdf.boe_ids);
  const normRows = [...new Set([...evidence.ia.verified_boe_ids, ...evidence.pdf.boe_ids])];

  return (
    <div>
      <p className="small muted">
        Comprueba el PDF contra lo que extrajo la IA y confirma. <strong>No es una validación
        jurídica</strong>: solo certifica que lo que se ve en el PDF es lo que queda registrado.
      </p>

      <table>
        <thead>
          <tr>
            <th>Campo</th>
            <th>Extraído por la IA</th>
            <th>Lo que dice el PDF</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Resultado del recurso de casación</td>
            <td>{label(OUTCOME, evidence.ia.outcome)}</td>
            <td>
              {evidence.pdf.sin_texto ? (
                <span className="badge warn">sin texto extraíble</span>
              ) : (
                <span className={`badge ${coincide ? "ok" : "ko"}`}>
                  {label(OUTCOME, evidence.pdf.outcome)} {coincide ? "(coincide)" : "(NO coincide)"}
                </span>
              )}
            </td>
          </tr>
          <tr>
            <td>Rama del derecho</td>
            <td>{label(BRANCH, evidence.ia.branch)}</td>
            <td className="small muted">—</td>
          </tr>
          <tr>
            <td>Normas citadas</td>
            <td className="small">{evidence.ia.verified_boe_ids.length} verificadas</td>
            <td className="small">
              {evidence.pdf.boe_ids.length} detectadas en el texto ({evidence.pdf.siglas.join(", ") || "ninguna"})
            </td>
          </tr>
          <tr>
            <td>Extensión</td>
            <td className="small">
              {evidence.ia.holdings} frases · {evidence.ia.facts} hechos
            </td>
            <td className="small muted">—</td>
          </tr>
        </tbody>
      </table>

      {evidence.pdf.fallo && (
        <blockquote style={{ marginTop: 12 }}>
          <strong>Fallo del PDF:</strong> «{evidence.pdf.fallo}…»
        </blockquote>
      )}

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(true);
        }}
        style={{ marginTop: 14, alignItems: "flex-end" }}
      >
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Resultado
          <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
            {Object.entries(OUTCOME).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Rama
          <select value={branch} onChange={(event) => setBranch(event.target.value)}>
            {Object.entries(BRANCH).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Título contiene
          <input
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
            placeholder="cláusula suelo"
          />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Frases mínimas
          <input
            value={holdings}
            onChange={(event) => setHoldings(event.target.value)}
            inputMode="numeric"
            style={{ width: 90 }}
          />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Hechos mínimos
          <input
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            inputMode="numeric"
            style={{ width: 90 }}
          />
        </label>
        <button type="submit" disabled={isPending}>
          {isPending ? "Guardando…" : entry?.confirmed ? "Actualizar confirmación" : "Confirmar"}
        </button>
        {entry?.confirmed && (
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={isPending}
            style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--muted)" }}
          >
            Quitar confirmación
          </button>
        )}
      </form>

      <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginTop: 4 }}>
        <legend className="small muted">Normas que debe citar el caso</legend>
        {normRows.map((boeId) => (
          <label key={boeId} className="small" style={{ display: "inline-flex", gap: 6, marginRight: 14 }}>
            <input
              type="checkbox"
              checked={norms.includes(boeId)}
              onChange={() =>
                setNorms((current) =>
                  current.includes(boeId)
                    ? current.filter((item) => item !== boeId)
                    : [...current, boeId],
                )
              }
            />
            <span className="mono">{boeId}</span> {enPdf.has(boeId) ? "✓ en PDF" : "(solo IA)"}
          </label>
        ))}
      </fieldset>

      <p className="small" style={{ marginTop: 10 }}>
        {entry?.confirmed ? (
          <span className="badge ok">confirmado a mano</span>
        ) : (
          <span className="badge warn">sin confirmar</span>
        )}{" "}
        {entry?.notes}
      </p>
      {saved && (
        <p className="small" style={{ color: "var(--green)" }}>
          Guardado
        </p>
      )}
      {error && (
        <p className="small" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
