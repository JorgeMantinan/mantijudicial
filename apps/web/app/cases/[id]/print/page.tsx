import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canViewCase, contextoVisibilidad } from "@/lib/auth";
import { getCase, getVias, listLaws } from "@/lib/dataset";
import { ARG_OUTCOME, BRANCH, CLAIM_OUTCOME, INSTANCE, KIND, OUTCOME, RESULT, SIDE, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function PrintCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^case_\d{6}$/.test(id)) notFound();
  const { actor, orgId, grants } = await contextoVisibilidad();
  if (!canViewCase(actor, id, orgId, grants)) redirect("/cases");

  const detail = await getCase(id);
  if (!detail) notFound();
  const [vias, laws] = await Promise.all([getVias(id), listLaws()]);
  const lawTitles = new Map(laws.map((law) => [law.boe_id, law.titulo]));
  const outcome = (detail.outcomeDetail?.outcome ?? {}) as {
    cassation_outcome?: string;
    recurring_side?: string;
    decisions?: Array<{ instance?: string; court?: string; date?: string; result?: string; description?: string }>;
    reasoning_summary?: string;
  };
  const summary = (detail.summary?.summary ?? {}) as {
    summary?: string;
    key_points?: string[];
  };

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href={`/cases/${id}`}>← Volver a la ficha</Link> ·{" "}
        <a href={`/api/export?resource=${id}`}>descargar JSON</a>
      </p>

      <h1 style={{ marginTop: 0 }}>{detail.headline}</h1>
      <p className="small">
        <strong>Caso:</strong> <span className="mono">{id}</span> ·{" "}
        <strong>Rama:</strong> {label(BRANCH, detail.branch)} ·{" "}
        <strong>Resultado casación:</strong> {label(OUTCOME, detail.outcome)} ·{" "}
        <strong>Recurrente:</strong> {label(SIDE, detail.recurringSide)} ·{" "}
        <strong>Revisión:</strong> {detail.reviewStatus}
      </p>

      <h2>Resumen</h2>
      <p>{summary.summary ?? "Sin resumen."}</p>
      {summary.key_points && summary.key_points.length > 0 && (
        <ul>
          {summary.key_points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}

      <h2>Resultado por instancia</h2>
      <ul>
        {(outcome.decisions ?? []).map((decision, index) => (
          <li key={`${decision.instance}-${index}`}>
            <strong>{label(INSTANCE, decision.instance)}</strong> · {decision.court} ·{" "}
            {decision.date} · {label(RESULT, decision.result)}
            <br />
            {decision.description}
          </li>
        ))}
      </ul>

      <h2>Partes</h2>
      <ul>
        {(detail.parties).map((party, index) => (
          <li key={index}>
            {party.name} — {label(SIDE, party.side)} ({label(KIND, party.kind)})
          </li>
        ))}
      </ul>

      <h2>Pretensiones</h2>
      <ul>
        {(detail.claims).map((claim, index) => (
          <li key={index}>
            {claim.description} — {label(CLAIM_OUTCOME, claim.outcome)}
          </li>
        ))}
      </ul>

      <h2>Argumentos</h2>
      <ul>
        {(detail.arguments).map(
          (argument, index) => (
            <li key={index}>
              [{label(ARG_OUTCOME, argument.outcome)}] {argument.description}
              {argument.legal_basis ? <em> ({argument.legal_basis})</em> : null}
            </li>
          ),
        )}
      </ul>

      <h2>Frases del tribunal</h2>
      {(detail.reasoning).map(
        (holding, index) => (
          <blockquote key={index}>
            {holding.statement}
            <div className="small muted">
              {holding.topic} · {holding.doctrine}
            </div>
          </blockquote>
        ),
      )}

      <h2>Leyes citadas verificadas</h2>
      <ul>
        {(detail.lawRefs)
          .filter((ref) => ref.status === "VERIFIED" && ref.boe_id)
          .map((ref, index) => (
            <li key={index}>
              {ref.norma} {ref.article_raw && ref.article_raw !== "UNKNOWN" ? `(${ref.article_raw})` : ""} —{" "}
              {lawTitles.get(ref.boe_id ?? "") ?? ref.boe_id}
            </li>
          ))}
      </ul>

      {vias && vias.report.vias.length > 0 && (
        <>
          <h2>Vías de actuación propuestas (IA, pendiente de validación por un abogado)</h2>
          <ol>
            {vias.report.vias.map((via) => (
              <li key={via.id}>
                <strong>
                  {via.titulo} (fuerza {via.fuerza})
                </strong>
                <br />
                {via.estrategia}
                {via.riesgos.length > 0 && (
                  <div className="small muted">Riesgos: {via.riesgos.join(" · ")}</div>
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="small muted">
        Documento generado por MantiJudicial. El análisis es asistido por IA y requiere revisión
        profesional. Las notas privadas del abogado no se incluyen en esta exportación.
      </p>
    </article>
  );
}
