import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Sumario } from "@/components/sumario";
import { canViewCase, defaultOrgId, loadIdentity, requireActor } from "@/lib/auth";
import { getCase, getEscrito, getVias, getVigenciaChecks, listLaws } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { fechaEs } from "@/lib/texto";
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

export default async function DossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ interno?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const interno = sp.interno === "1";
  if (!/^case_\d{6}$/.test(id)) notFound();
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  if (!canViewCase(actor, id, orgId, grants)) redirect("/cases");

  const detail = await getCase(id);
  if (!detail) notFound();

  const [vias, laws, identity, vigencias, escrito] = await Promise.all([
    getVias(id),
    listLaws(),
    loadIdentity(),
    getVigenciaChecks(id),
    getEscrito(id),
  ]);
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
  const rechazados = argumentos.filter(
    (argumento) =>
      !["ACEPTADO", "ACCEPTED", "PARTIALLY_ACCEPTED", "PARCIAL"].includes(
        (argumento.outcome ?? "").toUpperCase(),
      ),
  );
  const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href={`/cases/${id}`}>← Volver a la ficha interna</Link>
      </p>
      <PrintButton />
      <p className="small no-print">
        {interno ? (
          <>
            <span className="badge warn">Versión interna</span> — no enviar al cliente.{" "}
            <Link href={`/cases/${id}/dossier`}>Ver versión para el cliente</Link>
          </>
        ) : (
          <Link href={`/cases/${id}/dossier?interno=1`}>
            Ver versión interna (huecos, comprobaciones y argumentos no aceptados) →
          </Link>
        )}
      </p>
      <Sumario />

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

      {interno && (
        <div className="section">
          <h2>Uso interno: qué falta y qué arriesga</h2>
          <p className="small muted">
            Esta sección solo está en la versión interna del dossier (no se enseña al cliente).
          </p>

          <h3>Comprobaciones del borrador de escrito</h3>
          {(escrito?.report.comprobar_antes?.length ?? 0) > 0 ? (
            <ul className="small">
              {escrito!.report.comprobar_antes!.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Sin borrador generado todavía para este caso.</p>
          )}

          <h3>Huecos del expediente (según las vías)</h3>
          {vias && vias.report.huecos.length > 0 ? (
            <ul className="small">
              {vias.report.huecos.map((hueco) => (
                <li key={hueco.descripcion}>
                  <strong>{hueco.descripcion}</strong> — {hueco.como_cubrirlo}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Sin análisis de vías generado.</p>
          )}

          <h3>Argumentos no aceptados</h3>
          {rechazados.length > 0 ? (
            <ul className="small">
              {rechazados.map((argumento, index) => (
                <li key={`${argumento.type ?? ""}-${index}`}>
                  <span className="badge ko">{argumento.outcome ?? "sin dato"}</span>{" "}
                  {argumento.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Ninguno marcado como no aceptado.</p>
          )}
        </div>
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

      {vigencias.length > 0 && (
        <>
          <h2>Vigencia de las leyes citadas</h2>
          <p className="small muted">
            Si la versión vigente de un artículo es posterior a la sentencia, el texto puede haber
            cambiado desde entonces.
          </p>
          <table>
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Norma</th>
                <th>En la sentencia</th>
                <th>Versión actual</th>
              </tr>
            </thead>
            <tbody>
              {vigencias.map((item) => (
                <tr key={`${item.boe_id}-${item.block_id}`}>
                  <td className="mono small">
                    art. {item.article}
                    {item.titulo ? ` (${item.titulo})` : ""}
                  </td>
                  <td className="small">{item.norma}</td>
                  <td className="mono small">{fechaEs(item.version_en_sentencia)}</td>
                  <td className="small">
                    {item.cambio_posterior ? (
                      <span className="badge warn">
                        cambió después ({fechaEs(item.version_actual)})
                      </span>
                    ) : (
                      <span className="badge ok">sin cambios</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="small muted">
        Documento informativo preparado por {despacho || "el despacho"} con la plataforma MantiJudicial a partir de
        resoluciones y textos oficiales. No constituye asesoramiento jurídico ni sustituye la consulta con el abogado
        que lleva el asunto. Los análisis asistidos por IA están señalados como tales y requieren revisión
        profesional. Las notas privadas del abogado no se incluyen.
      </p>
    </article>
  );
}
