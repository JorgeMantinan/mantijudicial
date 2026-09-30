import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getTema } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { ARG_OUTCOME, ARG_TYPE, BRANCH, OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function TemaPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const ficha = await getTema(topic, (caseId) => canViewCase(actor, caseId, orgId, grants));
  if (!ficha) redirect("/evolucion");
  const { tema, argumentos, leyes } = ficha;

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/evolucion">← Evolución</Link> · <Link href="/patterns">Patrones</Link> ·{" "}
        <Link href="/alertas">Alertas</Link>
      </p>
      <PrintButton text="Imprimir la ficha del tema" />

      <h1>Tema: {tema.topic}</h1>
      <p className="lead">
        {tema.cases} casos entre {tema.first.slice(0, 10)} y {tema.last.slice(0, 10)} ·{" "}
        {Object.entries(tema.distribution)
          .map(([key, value]) => `${label(OUTCOME, key)} ${value}`)
          .join(" · ")}
      </p>
      <p className="small">
        <Link href={`/evolucion?tema=${encodeURIComponent(tema.topic)}`}>Cronología →</Link> ·{" "}
        <Link href={`/search?q=${encodeURIComponent(tema.topic)}`}>Buscar el tema en el corpus →</Link>
      </p>

      <div className="section">
        <h2>Casos del tema</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 110 }}>Fecha</th>
              <th>Caso</th>
              <th style={{ width: 150 }}>Resultado</th>
              <th>Frase del tribunal</th>
            </tr>
          </thead>
          <tbody>
            {tema.entries.map((entry) => (
              <tr key={entry.caseId}>
                <td className="mono small">{entry.fecha || "—"}</td>
                <td className="small">
                  <Link href={`/cases/${entry.caseId}`}>{entry.caseId.replace("case_", "")}</Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.headline.slice(0, 90)}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {label(BRANCH, entry.branch)}
                  </div>
                </td>
                <td>
                  <OutcomeBadge outcome={entry.outcome} />
                </td>
                <td className="small">
                  {entry.frase}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.doctrine}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Qué argumentos se usaron y cómo les fue</h2>
        <p className="small muted">
          Agregado de los argumentos de estos casos. Sirve para priorizar líneas de defensa; es una
          asociación, no una garantía.
        </p>
        {argumentos.length === 0 ? (
          <p className="small muted">Sin argumentos registrados.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo de argumento</th>
                <th>Aceptados</th>
                <th>Rechazados</th>
                <th>Parciales</th>
                <th>Sin analizar</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {argumentos.map((argumento) => (
                <tr key={argumento.tipo}>
                  <td className="small">{label(ARG_TYPE, argumento.tipo)}</td>
                  <td>
                    <span className="badge ok">{argumento.aceptados}</span>
                  </td>
                  <td>
                    <span className="badge ko">{argumento.rechazados}</span>
                  </td>
                  <td className="small">{argumento.parciales}</td>
                  <td className="small">{argumento.sinAnalizar}</td>
                  <td className="small">{argumento.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted">
          Nota: el desglose por resultado usa el campo <code>outcome</code> de cada argumento (
          {label(ARG_OUTCOME, "ACEPTADO")} / {label(ARG_OUTCOME, "RECHAZADO")}).
        </p>
      </div>

      <div className="section">
        <h2>Leyes citadas en estos casos</h2>
        {leyes.length === 0 ? (
          <p className="small muted">Sin leyes verificadas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Norma</th>
                <th>BOE</th>
                <th>Citas</th>
              </tr>
            </thead>
            <tbody>
              {leyes.map((ley) => (
                <tr key={`${ley.norma}-${ley.boe_id ?? ""}`}>
                  <td className="small">{ley.norma}</td>
                  <td className="mono small">
                    {ley.boe_id ? <Link href={`/laws/${ley.boe_id}`}>{ley.boe_id}</Link> : "—"}
                  </td>
                  <td>{ley.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small muted">
        Ficha generada automáticamente a partir de tu corpus. Los análisis de IA asociados están
        pendientes de validación profesional.
      </p>
    </article>
  );
}
