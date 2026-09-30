import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { canViewCase, defaultOrgId, loadIdentity, requireActor } from "@/lib/auth";
import { getCase, getVias, listLaws } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import {
  ARG_OUTCOME,
  BRANCH,
  CLAIM_OUTCOME,
  INSTANCE,
  KIND,
  OUTCOME,
  RESULT,
  SIDE,
  label,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^case_\d{6}$/.test(id)) notFound();
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  if (!canViewCase(actor, id, orgId, grants)) redirect("/cases");

  const detail = await getCase(id);
  if (!detail) notFound();

  const [vias, laws, identity] = await Promise.all([getVias(id), listLaws(), loadIdentity()]);
  const despacho = identity.listFirms().find((firm) => firm.id === orgId)?.name ?? "";
  const lawTitles = new Map(laws.map((law) => [law.boe_id, law.titulo]));
  const outcome = (detail.outcomeDetail?.outcome ?? {}) as {
    cassation_outcome?: string;
    recurring_side?: string;
    decisions?: Array<{ instance?: string; court?: string; date?: string; result?: string; description?: string }>;
    reasoning_summary?: string;
  };
  const summary = (detail.summary?.summary ?? {}) as { summary?: string; key_points?: string[] };
  const parties = (detail.parties ?? []) as Array<{ name?: string; side?: string; kind?: string }>;
  const claims = (detail.claims ?? []) as Array<{ description?: string; outcome?: string }>;
  const argumentos = (detail.arguments ?? []) as Array<{
    description?: string;
    type?: string;
    outcome?: string;
    legal_basis?: string;
  }>;
  const frases = (detail.reasoning ?? []) as Array<{ statement?: string; topic?: string; doctrine?: string }>;
  const leyes = (detail.lawRefs ?? []) as Array<{
    norma?: string;
    boe_id?: string | null;
    article_raw?: string;
    status?: string;
  }>;
  const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href={`/cases/${id}`}>← Volver a la ficha interna</Link>
      </p>
      <PrintButton />

      <p className="small" style={{ letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
        Dossier del asunto
      </p>
      <h1 style={{ marginTop: 0 }}>{detail.headline}</h1>
      <p className="small">
        {despacho ? <strong>Despacho:</strong> : null} {despacho} · <strong>Emitido:</strong> {hoy} ·{" "}
        <strong>Referencia interna:</strong> <span className="mono">{id}</span>
      </p>

      <h2>En resumen</h2>
      <p>{summary.summary ?? "Sin resumen disponible todavía."}</p>
      {summary.key_points && summary.key_points.length > 0 && (
        <ul>
          {summary.key_points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      <p className="small muted">
        Asunto de la rama {label(BRANCH, detail.branch)} · Resultado en casación:{" "}
        <strong>{label(OUTCOME, detail.outcome)}</strong>
      </p>

      <h2>Quién es quién</h2>
      <ul>
        {parties.map((party, index) => (
          <li key={index}>
            <strong>{party.name}</strong> — {label(SIDE, party.side)} ({label(KIND, party.kind)})
          </li>
        ))}
      </ul>

      <h2>Cómo ha ido el proceso</h2>
      {(outcome.decisions ?? []).length > 0 ? (
        <ul>
          {(outcome.decisions ?? []).map((decision, index) => (
            <li key={`${decision.instance}-${index}`}>
              <strong>{label(INSTANCE, decision.instance)}</strong> · {decision.court} · {decision.date} ·{" "}
              {label(RESULT, decision.result)}
              <br />
              {decision.description}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">Sin detalle de instancias.</p>
      )}

      <h2>Lo que se pidió y qué se resolvió</h2>
      <ul>
        {claims.map((claim, index) => (
          <li key={index}>
            {claim.description} — <strong>{label(CLAIM_OUTCOME, claim.outcome)}</strong>
          </li>
        ))}
      </ul>

      <h2>Argumentos que funcionaron</h2>
      <p className="small muted">Los que el tribunal aceptó son los que conviene reutilizar en futuras estrategias.</p>
      <ul>
        {argumentos.map((argument, index) => (
          <li key={index}>
            <strong>{label(ARG_OUTCOME, argument.outcome)}</strong> · {argument.description}
            {argument.legal_basis ? <em> ({argument.legal_basis})</em> : null}
          </li>
        ))}
      </ul>

      {frases.length > 0 && (
        <>
          <h2>Frases clave de la sentencia</h2>
          {frases.slice(0, 5).map((frase, index) => (
            <blockquote key={index}>
              {frase.statement}
              <div className="small muted">
                {frase.topic} · {frase.doctrine}
              </div>
            </blockquote>
          ))}
        </>
      )}

      {vias && vias.report.vias.length > 0 && (
        <>
          <h2>Qué podemos hacer a partir de ahora</h2>
          <p className="small muted">
            Propuestas orientativas generadas con ayuda de IA y <strong>pendientes de validación</strong> por el
            equipo de abogados antes de decidir nada.
          </p>
          <ol>
            {vias.report.vias.map((via) => (
              <li key={via.id}>
                <strong>
                  {via.titulo} (fuerza {via.fuerza})
                </strong>
                <br />
                {via.estrategia}
                {via.riesgos.length > 0 && <div className="small muted">Riesgos: {via.riesgos.join(" · ")}</div>}
              </li>
            ))}
          </ol>
        </>
      )}

      <h2>Leyes de referencia</h2>
      <ul>
        {leyes
          .filter((ref) => ref.status === "VERIFIED" && ref.boe_id)
          .map((ref, index) => (
            <li key={index}>
              {ref.norma} {ref.article_raw && ref.article_raw !== "UNKNOWN" ? `(${ref.article_raw})` : ""} —{" "}
              {lawTitles.get(ref.boe_id ?? "") ?? ref.boe_id}
            </li>
          ))}
      </ul>

      <p className="small muted">
        Documento informativo preparado por {despacho || "el despacho"} con la plataforma MantiJudicial a partir de
        resoluciones y textos oficiales. No constituye asesoramiento jurídico ni sustituye la consulta con el abogado
        que lleva el asunto. Los análisis asistidos por IA están señalados como tales y requieren revisión
        profesional. Las notas privadas del abogado no se incluyen.
      </p>
    </article>
  );
}
