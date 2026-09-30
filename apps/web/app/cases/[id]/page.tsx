import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canShareResource } from "@pipeline/authorization";
import { canViewCase, caseResource, defaultOrgId, loadIdentity, requireActor } from "@/lib/auth";
import { getCase, getSimilarCases, getVias, listLaws } from "@/lib/dataset";
import { authorizationGrants, loadGrantStore } from "@/lib/grants";
import {
  ARG_OUTCOME,
  ARG_TYPE,
  BRANCH,
  CLAIM_OUTCOME,
  EVENT,
  FACT_STATUS,
  FACT_TYPE,
  FORCE,
  INSTANCE,
  KIND,
  LAW_STATUS,
  OUTCOME,
  QUOTE,
  RESULT,
  REVIEW,
  SCOPE,
  SIDE,
  YESNO,
  label,
} from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";
import { ReviewForm } from "./review-form";
import { NotesPanel } from "./notes-panel";
import { SharePanel, type ShareGrantView } from "./share-panel";

export const dynamic = "force-dynamic";

type Party = {
  party_id?: string;
  name?: string;
  side?: string;
  kind?: string;
  representation?: string;
  is_consumer?: string;
  notes?: string;
};
type Claim = {
  claim_id?: string;
  claimant?: string;
  side?: string;
  description?: string;
  outcome?: string;
  outcome_scope?: string;
};
type Fact = { fact_id?: string; description?: string; fact_type?: string; status?: string; importance?: number };
type Event = { event_id?: string; date?: string; description?: string; event_type?: string };
type Argument = {
  argument_id?: string;
  side?: string;
  type?: string;
  description?: string;
  legal_basis?: string;
  outcome?: string;
  importance?: number;
};
type Holding = {
  holding_id?: string;
  statement?: string;
  topic?: string;
  legal_basis?: string;
  doctrine?: string;
  importance?: number;
  is_literal_quote?: boolean;
};
type Issue = { issue_id?: string; topic?: string; description?: string; importance?: number };
type Citation = { citation_id?: string; raw_text?: string; norma?: string; article?: string; relevance?: string };
type Ref = {
  norma?: string;
  article_raw?: string;
  boe_id?: string | null;
  ai_boe_id?: string | null;
  id_conflict?: boolean;
  id_source?: string | null;
  status?: string;
  quote_check?: string;
  articles?: Array<{ number?: number; block_id?: string | null; titulo?: string | null; status?: string }>;
};
type Decision = { instance?: string; court?: string; date?: string; result?: string; description?: string };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^case_\d{6}$/.test(id)) notFound();
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  if (!canViewCase(actor, id, orgId, grants)) redirect("/cases");
  const detail = await getCase(id);
  if (!detail) notFound();

  const [laws, similar, vias, identity, grantStore] = await Promise.all([
    listLaws(),
    getSimilarCases(id, 5),
    getVias(id),
    loadIdentity(),
    loadGrantStore(),
  ]);

  const users = identity.listUsers().map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
  }));
  const userLabels = new Map(users.map((user) => [user.id, `${user.name} <${user.email}>`]));
  const firmLabels = new Map(identity.listFirms().map((firm) => [firm.id, firm.name]));
  const shareGrants: ShareGrantView[] = grantStore.list(id).map((grant) => ({
    id: grant.id,
    grantee: grant.granteeUserId
      ? (userLabels.get(grant.granteeUserId) ?? grant.granteeUserId)
      : (grant.granteeOrgId ? (firmLabels.get(grant.granteeOrgId) ?? grant.granteeOrgId) : "—"),
    granteeUserId: grant.granteeUserId,
    actions: grant.actions,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
  }));
  const canShare = canShareResource(actor, caseResource(id, orgId));
  const lawTitles = new Map(laws.map((law) => [law.boe_id, law.titulo]));
  const outcome = (detail.outcomeDetail?.outcome ?? {}) as {
    cassation_outcome?: string;
    recurring_side?: string;
    reasoning_summary?: string;
    decisions?: Decision[];
    claim_outcomes?: Array<{ claim_ref?: string; outcome?: string }>;
  };
  const summary = (detail.summary?.summary ?? {}) as {
    summary?: string;
    key_points?: string[];
    missing_information?: string[];
  };
  const review = (detail.review?.extraction ?? {}) as {
    model?: string;
    prompt_version?: string;
    tokens?: { total?: number };
    cost?: number;
    validation?: string;
    generated_at?: string;
  };

  const reviewBlock = (detail.review?.review ?? {}) as {
    status?: string;
    reviewed_by?: string | null;
    reviewed_at?: string | null;
    notes?: string;
  };

  return (
    <>
      <p className="small muted">
        <Link href="/cases">← Volver a casos</Link>
      </p>
      <h1 style={{ marginTop: 4 }}>{detail.headline}</h1>
      <p className="lead">
        <span className="mono">{id}</span> · {label(BRANCH, detail.branch)} ·{" "}
        <OutcomeBadge outcome={detail.outcome} /> · recurrente: {label(SIDE, detail.recurringSide)} ·{" "}
        <span className="badge">
          revisión: {label(REVIEW, reviewBlock.status ?? "UNREVIEWED")}
          {reviewBlock.reviewed_by ? ` por ${reviewBlock.reviewed_by}` : ""}
        </span>
      </p>

      <div className="section">
        <h2>Revisión humana</h2>
        <p className="small muted">
          El análisis lo produjo la IA: registra aquí si lo has verificado, corregido o rechazado.
          La trazabilidad queda en <span className="mono">structured/review.json</span>.
        </p>
        {reviewBlock.reviewed_at && (
          <p className="small muted">
            Última revisión: {reviewBlock.reviewed_at} · {reviewBlock.notes}
          </p>
        )}
        <ReviewForm caseId={id} current={reviewBlock} />
      </div>

      <SharePanel
        caseId={id}
        canShare={canShare}
        users={users}
        currentUserId={actor.userId}
        grants={shareGrants}
      />

      <NotesPanel caseId={id} />

      <div className="section">
        <h2>Resumen</h2>
        <p>{summary.summary ?? "Sin resumen."}</p>
        {summary.key_points && summary.key_points.length > 0 && (
          <>
            <h3>Puntos clave</h3>
            <ul>
              {summary.key_points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </>
        )}
        {outcome.reasoning_summary && <blockquote>{outcome.reasoning_summary}</blockquote>}
      </div>

      {vias ? (
        <div className="section">
          <h2>Vías de actuación propuestas (IA)</h2>
          <p className="small muted">
            {vias.analysis.generated_at} · modelo <span className="mono">{vias.analysis.model}</span>{" "}
            · prompt <span className="mono">{vias.analysis.prompt_version}</span> · casos de apoyo:{" "}
            {(vias.analysis.similar_case_ids ?? []).join(", ") || "—"}
          </p>
          {vias.report.avisos.length > 0 && (
            <div className="notice">{vias.report.avisos.join(" ")}</div>
          )}

          {vias.report.vias.map((via) => (
            <div
              key={via.id}
              style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}
            >
              <h3 style={{ marginBottom: 4 }}>
                {via.id} · {via.titulo}{" "}
                <span className={`badge ${via.fuerza === "ALTA" ? "ok" : via.fuerza === "MEDIA" ? "warn" : ""}`}>
                  fuerza {label(FORCE, via.fuerza)}
                </span>
              </h3>
              <p>{via.estrategia}</p>

              {via.argumentos.length > 0 && (
                <>
                  <h3>Argumentos y apoyos</h3>
                  <ul className="small">
                    {via.argumentos.map((argumento, index) => (
                      <li key={`${via.id}-${index}`}>
                        {argumento.argumento}
                        <div className="muted">
                          apoyo:{" "}
                          {argumento.apoyo_case_id.startsWith("case_") ? (
                            <Link href={`/cases/${argumento.apoyo_case_id}`}>{argumento.apoyo_case_id}</Link>
                          ) : (
                            argumento.apoyo_case_id
                          )}{" "}
                          · ley: {argumento.ley}
                          {argumento.apoyo_frase !== "UNKNOWN" && (
                            <div>«{argumento.apoyo_frase}»</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {via.evidencia_a_solicitar.length > 0 && (
                <>
                  <h3>Evidencia a solicitar</h3>
                  <ul className="small">
                    {via.evidencia_a_solicitar.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}

              {via.riesgos.length > 0 && (
                <>
                  <h3>Riesgos</h3>
                  <ul className="small">
                    {via.riesgos.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}

          {vias.report.huecos.length > 0 && (
            <>
              <h3>Huecos en el expediente</h3>
              <table>
                <thead>
                  <tr>
                    <th>Falta</th>
                    <th>Cómo cubrirlo</th>
                  </tr>
                </thead>
                <tbody>
                  {vias.report.huecos.map((hueco) => (
                    <tr key={hueco.descripcion}>
                      <td className="small">{hueco.descripcion}</td>
                      <td className="small">{hueco.como_cubrirlo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {vias.report.consultas_al_cliente.length > 0 && (
            <>
              <h3>Consultas al cliente</h3>
              <ul className="small">
                {vias.report.consultas_al_cliente.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="section">
          <h2>Vías de actuación (IA)</h2>
          <p className="small muted">
            Sin análisis generado. Ejecuta{" "}
            <span className="mono">pnpm vias -- --cases={id}</span> para producirlo.
          </p>
        </div>
      )}

      <div className="section">
        <h2>Resultado</h2>
        <dl className="kv">
          <dt>Recurso de casación</dt>
          <dd>
            <OutcomeBadge outcome={outcome.cassation_outcome ?? detail.outcome} />
          </dd>
          <dt>Lado recurrente</dt>
          <dd>{label(SIDE, outcome.recurring_side ?? detail.recurringSide)}</dd>
          <dt>Asunto</dt>
          <dd>{detail.subtopic || "—"}</dd>
        </dl>
        {outcome.decisions && outcome.decisions.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Instancia</th>
                <th>Órgano</th>
                <th>Fecha</th>
                <th>Resultado</th>
                <th>Decisión</th>
              </tr>
            </thead>
            <tbody>
              {outcome.decisions.map((decision, index) => (
                <tr key={`${decision.instance}-${index}`}>
                  <td className="small">{label(INSTANCE, decision.instance)}</td>
                  <td className="small">{decision.court}</td>
                  <td className="small">{decision.date}</td>
                  <td>
                    <span className="badge" title={decision.result}>
                      {label(RESULT, decision.result)}
                    </span>
                  </td>
                  <td className="small">{decision.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Partes</h2>
        <table>
          <thead>
            <tr>
              <th>Parte</th>
              <th>Lado</th>
              <th>Tipo</th>
              <th>Representación</th>
              <th>Consumidor</th>
            </tr>
          </thead>
          <tbody>
            {(detail.parties as Party[]).map((party) => (
              <tr key={party.party_id}>
                <td>{party.name}</td>
                <td className="small" title={party.side}>
                  {label(SIDE, party.side)}
                </td>
                <td className="small" title={party.kind}>
                  {label(KIND, party.kind)}
                </td>
                <td className="small">{party.representation}</td>
                <td className="small">{label(YESNO, party.is_consumer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Pretensiones</h2>
        <table>
          <thead>
            <tr>
              <th>Pretensión</th>
              <th>Pide</th>
              <th>Resultado</th>
              <th>Alcance</th>
            </tr>
          </thead>
          <tbody>
            {(detail.claims as Claim[]).map((claim) => (
              <tr key={claim.claim_id}>
                <td className="small">{claim.description}</td>
                <td className="small">{claim.claimant}</td>
                <td>
                  <span className="badge" title={claim.outcome}>
                    {label(CLAIM_OUTCOME, claim.outcome)}
                  </span>
                </td>
                <td className="small" title={claim.outcome_scope}>
                  {label(SCOPE, claim.outcome_scope)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Hechos</h2>
        <ol>
          {(detail.facts as Fact[]).map((fact) => (
            <li key={fact.fact_id}>
              {fact.description}{" "}
              <span className="muted small">
                ({label(FACT_TYPE, fact.fact_type)} · {label(FACT_STATUS, fact.status)} · importancia{" "}
                {fact.importance})
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="section">
        <h2>Cronología</h2>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Evento</th>
            </tr>
          </thead>
          <tbody>
            {(detail.timeline as Event[]).map((event) => (
              <tr key={event.event_id}>
                <td className="mono small">{event.date}</td>
                <td className="small" title={event.event_type}>
                  {label(EVENT, event.event_type)}
                </td>
                <td className="small">{event.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Argumentos</h2>
        <table>
          <thead>
            <tr>
              <th>Lado</th>
              <th>Tipo</th>
              <th>Argumento</th>
              <th>Base legal</th>
              <th>Aceptación</th>
            </tr>
          </thead>
          <tbody>
            {(detail.arguments as Argument[]).map((argument) => (
              <tr key={argument.argument_id}>
                <td className="small" title={argument.side}>
                  {label(SIDE, argument.side)}
                </td>
                <td className="small" title={argument.type}>
                  {label(ARG_TYPE, argument.type)}
                </td>
                <td className="small">{argument.description}</td>
                <td className="small">{argument.legal_basis}</td>
                <td>
                  <span className="badge" title={argument.outcome}>
                    {label(ARG_OUTCOME, argument.outcome)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Frases del tribunal (ratio decidendi)</h2>
        {(detail.reasoning as Holding[]).map((holding) => (
          <div key={holding.holding_id} style={{ marginBottom: 12 }}>
            <blockquote>
              {holding.is_literal_quote ? `«${holding.statement}»` : holding.statement}
            </blockquote>
            <div className="small muted">
              tema: {holding.topic} · base: {holding.legal_basis} · doctrina: {holding.doctrine} ·
              importancia {holding.importance}
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <h2>Cuestiones planteadas</h2>
        <ul>
          {(detail.issues as Issue[]).map((issue) => (
            <li key={issue.issue_id}>
              <strong>{issue.topic}</strong>: {issue.description}
            </li>
          ))}
        </ul>
      </div>

      <div className="section">
        <h2>Casos similares</h2>
        <p className="small muted">
          Recuperados por similitud léxica sobre resumen, temas y doctrina; se explica por qué
          aparecen.
        </p>
        {similar.length === 0 && <p className="muted">Sin similares suficientes.</p>}
        {similar.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Caso</th>
                <th>Rama</th>
                <th>Resultado</th>
                <th>Por qué</th>
              </tr>
            </thead>
            <tbody>
              {similar.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/cases/${item.id}`}>{item.title}</Link>
                    <div className="small muted mono">
                      {item.id} · score {item.score}
                    </div>
                  </td>
                  <td className="small" title={item.branch}>
                    {label(BRANCH, item.branch)}
                  </td>
                  <td>
                    <OutcomeBadge outcome={item.outcome} />
                  </td>
                  <td className="small">{item.why.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Leyes citadas</h2>
        <table>
          <thead>
            <tr>
              <th>Cita</th>
              <th>Norma</th>
              <th>Artículo</th>
              <th>Verificación</th>
            </tr>
          </thead>
          <tbody>
            {(detail.lawRefs as Ref[]).map((ref, index) => {
              const first = ref.articles?.[0];
              const href =
                ref.boe_id && first?.block_id
                  ? `/laws/${ref.boe_id}#${first.block_id}`
                  : ref.boe_id
                    ? `/laws/${ref.boe_id}`
                    : null;
              return (
                <tr key={`${ref.norma}-${index}`}>
                  <td className="small">{ref.norma}</td>
                  <td className="small">
                    {href ? <Link href={href}>{lawTitles.get(ref.boe_id ?? "") ?? ref.boe_id}</Link> : ref.boe_id ?? "—"}
                  </td>
                  <td className="mono small">{ref.article_raw || "—"}</td>
                  <td className="small">
                    <span
                      className={`badge ${ref.status === "VERIFIED" ? "ok" : ref.status === "NON_BOE" ? "" : "warn"}`}
                      title={ref.status}
                    >
                      {label(LAW_STATUS, ref.status)}
                    </span>
                    {first?.titulo ? ` ${first.titulo}` : ""}
                    {ref.quote_check && ref.quote_check !== "NOT_CHECKED" && (
                      <div className="muted" title={ref.quote_check}>
                        cita literal: {label(QUOTE, ref.quote_check)}
                      </div>
                    )}
                    {ref.id_conflict && (
                      <div className="muted mono">
                        id propuesto por la IA: {ref.ai_boe_id} (descartado)
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {(detail.lawRefs as Ref[]).length === 0 && (detail.citedLaws as Citation[]).length > 0 &&
              (detail.citedLaws as Citation[]).map((citation) => (
                <tr key={citation.citation_id}>
                  <td className="small" colSpan={3}>
                    {citation.raw_text}
                  </td>
                  <td className="small muted">sin verificar</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Trazabilidad de la extracción</h2>
        <dl className="kv">
          <dt>Validación</dt>
          <dd>{detail.enriched ? "Correcta" : review.validation === "PENDING" ? "Pendiente" : (review.validation ?? "Pendiente")}</dd>
          <dt>Modelo</dt>
          <dd className="mono">{review.model ?? "—"}</dd>
          <dt>Versión de prompt</dt>
          <dd className="mono">{review.prompt_version ?? "—"}</dd>
          <dt>Tokens totales</dt>
          <dd>{review.tokens?.total ?? "—"}</dd>
          <dt>Coste</dt>
          <dd>{review.cost !== undefined ? `$${review.cost.toFixed(4)}` : "—"}</dd>
          <dt>Generado</dt>
          <dd className="mono">{review.generated_at ?? "—"}</dd>
        </dl>
      </div>
    </>
  );
}
