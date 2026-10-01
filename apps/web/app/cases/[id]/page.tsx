import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canCreateCase, canShareResource } from "@pipeline/authorization";
import { canViewCase, caseResource, defaultOrgId, loadIdentity, requireActor } from "@/lib/auth";
import { getAuditoria, getCase, getClientes, getComparisons, getDoctrinaCitada, getEscrito, getGoldenInfo, getRecomendaciones, getReviewStats, getSentenciasCitadas, getSimilarCases, getVigenciaChecks, getVias, listLaws } from "@/lib/dataset";
import { authorizationGrants, loadGrantStore } from "@/lib/grants";
import {
  ARG_OUTCOME,
  ARG_TYPE,
  AUDIT,
  BRANCH,
  CLAIM_OUTCOME,
  EVENT,
  ESCRITO_TIPO,
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
import { ArchiveButton } from "./archive-button";
import { CopyButton } from "@/components/copy-button";
import { ClientePanel } from "@/components/cliente-panel";
import { GoldenPanel } from "./golden-panel";
import { NotesPanel } from "./notes-panel";
import { ReanalyzeButton } from "./reanalyze-button";
import { ComparePanel } from "./compare-panel";
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
type CompareReport = {
  aplicabilidad?: string;
  conclusion?: string;
  similitudes?: Array<{ aspecto?: string; detalle?: string; apoyo_case_id?: string }>;
  diferencias?: Array<{ aspecto?: string; detalle?: string; impacto?: string }>;
  argumentos_efectivos?: Array<{
    argumento?: string;
    apoyo_case_id?: string;
    apoyo_frase?: string;
    resultado?: string;
  }>;
  huecos?: Array<{ descripcion?: string; como_cubrirlo?: string }>;
  contraargumentos?: Array<{
    del_contrario?: string;
    nuestra_respuesta?: string;
    apoyo_case_id?: string;
  }>;
  riesgos?: string[];
  avisos?: string[];
};

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

const PAPELES: Record<string, string> = {
  DOCTRINE_APPLIED: "Doctrina aplicada",
  DISTINGUISHED: "Distinguida",
  QUESTIONED: "Puesta en duda",
  REJECTED: "No aplicada",
  CITED: "Citada",
  MENTIONED: "Mencionada",
  FOLLOWED: "Seguida",
};

function fechaEs(yyyymmdd: string | null | undefined): string {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return yyyymmdd || "—";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

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

  const [laws, similar, vias, comparisons, identity, grantStore, golden, sentencias, vigencias, escrito, reviewStats, actividadCaso, doctrina, clientes] =
    await Promise.all([
      listLaws(),
      getSimilarCases(id, 5),
      getVias(id),
      getComparisons(id),
      loadIdentity(),
      loadGrantStore(),
      getGoldenInfo(id),
      getSentenciasCitadas(id),
      getVigenciaChecks(id),
      getEscrito(id),
      getReviewStats(),
      getAuditoria(15, id),
      getDoctrinaCitada(id),
      getClientes(),
    ]);

  const recomendaciones = await getRecomendaciones(
    id,
    similar.map((item) => item.id),
  );
  const nextPendiente = reviewStats.pending.find((item) => item.id !== id)?.id ?? null;

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
  const canCreate = canCreateCase(actor);
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

  const argumentosDetalle = (detail.arguments ?? []) as Array<{
    description?: string;
    type?: string;
    outcome?: string;
  }>;
  const sinAnalizar = argumentosDetalle.filter((argumento) =>
    ["", "UNKNOWN", "NOT_ANALYZED", "DESCONOCIDO"].includes((argumento.outcome ?? "").toUpperCase()),
  );
  const huecosVias = vias?.report.huecos ?? [];
  const comprobarBorrador = escrito?.report.comprobar_antes ?? [];
  const huecosComparaciones = comparisons.reduce(
    (total, comparison) => total + ((comparison.report as CompareReport).huecos ?? []).length,
    0,
  );
  const hayFaltas =
    sinAnalizar.length > 0 ||
    huecosVias.length > 0 ||
    comprobarBorrador.length > 0 ||
    huecosComparaciones > 0;

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
          revisión: {label(REVIEW, detail.reviewStatus)}
          {reviewBlock.reviewed_by ? ` por ${reviewBlock.reviewed_by}` : ""}
        </span>
        {detail.stale && <span className="badge warn">el PDF cambió desde el análisis</span>}
        <span className="no-print">
          {" · "}
          <a href={`/api/export?resource=${id}`}>exportar JSON</a>
          {" · "}
          <Link href={`/cases/${id}/print`}>imprimir ficha</Link>
          {" · "}
          <Link href={`/cases/${id}/dossier`}>dossier para el cliente</Link>
          {" · "}
          <CopyButton path={`/cases/${id}`} etiqueta="Copiar enlace" />
          {" · "}
          <ArchiveButton caseId={id} archived={detail.archived} canArchive={canCreate} />
        </span>
      </p>

      <ReanalyzeButton caseId={id} stale={detail.stale} />

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
        <ReviewForm caseId={id} current={reviewBlock} nextId={nextPendiente} />
      </div>

      <div className="section">
        <h2>Validación del caso</h2>
        {golden ? (
          <GoldenPanel
            caseId={id}
            initialEntry={golden.entry}
            initialEvidence={golden.evidence}
          />
        ) : (
          <p className="small muted">Sin evidencia disponible (falta el texto extraído).</p>
        )}
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
        <h2>Cliente / encargo</h2>
        <p className="small muted">
          Para filtrar en la lista de casos y agrupar los asuntos de un mismo cliente. Solo lo ve
          el despacho (no sale en los dossiers).{" "}
          <Link href="/clientes">Ver panel de clientes →</Link>
        </p>
        <ClientePanel caseId={id} cliente={clientes[id] ?? ""} />
      </div>

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

      {(recomendaciones.frases.length > 0 ||
        recomendaciones.argumentos.length > 0 ||
        recomendaciones.leyes.length > 0) && (
        <div className="section">
          <h2>Cómo se ha ganado en casos parecidos</h2>
          <p className="small muted">
            A partir de los {similar.length} casos más parecidos al tuyo: frases que acompañan a
            ganar, argumentos que les funcionaron y leyes que citaron. Es material de partida para
            orientar el escrito — <strong>asociación, no predicción</strong>.
          </p>

          {recomendaciones.frases.length > 0 && (
            <>
              <h3>Frases recomendadas (con su historial)</h3>
              <ul className="small">
                {recomendaciones.frases.map((grupo) => (
                  <li key={grupo.ejemplo} style={{ marginBottom: 4 }}>
                    <Link href={`/patrones/frase?e=${encodeURIComponent(grupo.ejemplo)}`}>
                      {grupo.ejemplo.length > 140 ? `${grupo.ejemplo.slice(0, 140)}…` : grupo.ejemplo}
                    </Link>{" "}
                    <span className={`badge ${grupo.homogenea >= 90 ? "ok" : "warn"}`}>
                      {grupo.homogenea}% igual
                    </span>{" "}
                    {Object.entries(grupo.distribucion).map(([outcome, cantidad]) => (
                      <span
                        key={outcome}
                        className={`badge ${outcome === "ESTIMED" ? "ok" : outcome === "DISMISSED" ? "ko" : "warn"}`}
                        style={{ marginRight: 4 }}
                      >
                        {label(OUTCOME, outcome)} {cantidad}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}

          {recomendaciones.argumentos.length > 0 && (
            <>
              <h3>Argumentos que les funcionaron</h3>
              <ul className="small">
                {recomendaciones.argumentos.map((argumento, index) => (
                  <li key={`${argumento.caseId}-${index}`} style={{ marginBottom: 4 }}>
                    <span className="badge ok">{label(ARG_TYPE, argumento.type)}</span>{" "}
                    {argumento.description}{" "}
                    <Link href={`/cases/${argumento.caseId}`}>
                      ({argumento.caseId.replace("case_", "")})
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {recomendaciones.leyes.length > 0 && (
            <>
              <h3>Leyes citadas en los casos parecidos</h3>
              <ul className="small">
                {recomendaciones.leyes.map((ley) => (
                  <li key={`${ley.boe_id}-${ley.block_id}-${ley.article}`}>
                    {ley.norma} art. {ley.article}{" "}
                    <Link
                      href={`/laws/${ley.boe_id}${ley.block_id ? `?block=${ley.block_id}` : ""}`}
                    >
                      ver texto
                    </Link>{" "}
                    <span className="muted">
                      ({ley.casos} caso{ley.casos === 1 ? "" : "s"})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {hayFaltas && (
        <div className="section">
          <h2>Qué falta por concretar</h2>
          <p className="small muted">
            Consolidado de lo que los análisis señalan como pendiente: comprobaciones del borrador,
            huecos del expediente y argumentos sin analizar.
          </p>

          {comprobarBorrador.length > 0 && (
            <>
              <h3>Comprobaciones del borrador de escrito ({comprobarBorrador.length})</h3>
              <ul className="small">
                {comprobarBorrador.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {huecosVias.length > 0 && (
            <>
              <h3>Huecos del expediente ({huecosVias.length})</h3>
              <ul className="small">
                {huecosVias.map((hueco) => (
                  <li key={hueco.descripcion}>
                    <strong>{hueco.descripcion}</strong> — {hueco.como_cubrirlo}
                  </li>
                ))}
              </ul>
            </>
          )}

          {sinAnalizar.length > 0 && (
            <>
              <h3>Argumentos sin analizar ({sinAnalizar.length})</h3>
              <ul className="small">
                {sinAnalizar.map((argumento, index) => (
                  <li key={`${argumento.type ?? ""}-${index}`}>
                    <span className="badge warn">{label(ARG_TYPE, argumento.type)}</span>{" "}
                    {argumento.description}
                  </li>
                ))}
              </ul>
            </>
          )}

          {huecosComparaciones > 0 && (
            <p className="small">
              Las comparaciones con otros casos acumulan <strong>{huecosComparaciones}</strong>{" "}
              huecos más: están en la sección de abajo.
            </p>
          )}
        </div>
      )}

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

      <details className="section">
        <summary style={{ cursor: "pointer", fontSize: 18, fontWeight: 600 }}>
          Comparaciones con otros casos
        </summary>
        <p className="small muted">
          Huecos del expediente, argumentos efectivos y contraargumentos previstos. Análisis con IA
          pendiente de validación por un abogado.
        </p>

        {comparisons.map((comparison) => {
          const report = comparison.report as CompareReport;
          return (
            <article
              key={comparison.otro_caso}
              style={{ borderTop: "1px solid var(--line)", paddingTop: 12, marginTop: 12 }}
            >
              <h3 style={{ marginBottom: 4 }}>
                vs.{" "}
                <Link href={`/cases/${comparison.otro_caso}`}>{comparison.otro_caso}</Link>{" "}
                <span
                  className={`badge ${report.aplicabilidad === "ALTA" ? "ok" : report.aplicabilidad === "MEDIA" ? "warn" : ""}`}
                >
                  aplicabilidad {report.aplicabilidad ?? "—"}
                </span>{" "}
                <Link
                  className="small"
                  href={`/cases/${id}/compare/${comparison.otro_caso}`}
                >
                  informe imprimible
                </Link>
              </h3>
              {comparison.generated_at && (
                <p className="small muted">{comparison.generated_at}</p>
              )}

              {report.conclusion && <blockquote>{report.conclusion}</blockquote>}

              {report.similitudes && report.similitudes.length > 0 && (
                <>
                  <h3>Similitudes</h3>
                  <ul className="small">
                    {report.similitudes.map((item, index) => (
                      <li key={index}>
                        <strong>{item.aspecto}:</strong> {item.detalle}{" "}
                        {item.apoyo_case_id?.startsWith("case_") && (
                          <Link href={`/cases/${item.apoyo_case_id}`}>{item.apoyo_case_id}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {report.diferencias && report.diferencias.length > 0 && (
                <>
                  <h3>Diferencias</h3>
                  <ul className="small">
                    {report.diferencias.map((item, index) => (
                      <li key={index}>
                        <strong>{item.aspecto}:</strong> {item.detalle}{" "}
                        {item.impacto && <em>(impacto: {item.impacto})</em>}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {report.huecos && report.huecos.length > 0 && (
                <>
                  <h3>Huecos del expediente</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Qué falta</th>
                        <th>Cómo cubrirlo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.huecos.map((item, index) => (
                        <tr key={index}>
                          <td className="small">{item.descripcion}</td>
                          <td className="small">{item.como_cubrirlo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {report.contraargumentos && report.contraargumentos.length > 0 && (
                <>
                  <h3>Contraargumentos previstos</h3>
                  <ul className="small">
                    {report.contraargumentos.map((item, index) => (
                      <li key={index}>
                        <strong>Puede decir la parte contraria:</strong> {item.del_contrario}
                        <br />
                        <strong>Respuesta:</strong> {item.nuestra_respuesta}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {report.riesgos && report.riesgos.length > 0 && (
                <>
                  <h3>Riesgos</h3>
                  <ul className="small">
                    {report.riesgos.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </>
              )}

              {report.avisos && report.avisos.length > 0 && (
                <div className="notice">{report.avisos.join(" ")}</div>
              )}
            </article>
          );
        })}

        <h3>Generar una comparación</h3>
        <ComparePanel
          caseId={id}
          options={similar.map((item) => ({ id: item.id, title: item.title }))}
          existing={comparisons.map((item) => item.otro_caso)}
        />
      </details>

      {escrito && escrito.report.cuerpo.length > 0 && (
        <div className="section">
          <h2>Borrador de escrito (IA)</h2>
          <div className="notice">
            Generado por IA a partir de este caso y de las normas verificadas del BOE. Es un punto de
            partida, no un escrito presentado: debe revisarlo un letrado antes de usarlo.
          </div>

          <p>
            <strong>{label(ESCRITO_TIPO, escrito.report.tipo)}</strong> · {escrito.report.asunto}
          </p>
          <p className="small muted">
            {escrito.report.encabezado?.tribunal || "Tribunal por confirmar"}
            {escrito.report.encabezado?.numero_recurso
              ? ` · Recurso ${escrito.report.encabezado.numero_recurso}`
              : ""}
            {escrito.report.encabezado?.procurador ? ` · Procurador ${escrito.report.encabezado.procurador}` : ""}
            {escrito.report.encabezado?.letrado ? ` · Letrado ${escrito.report.encabezado.letrado}` : ""}
          </p>

          {escrito.report.cuerpo.map((bloque) => (
            <article key={bloque.titulo}>
              <h3>{bloque.titulo}</h3>
              <p>{bloque.texto}</p>
            </article>
          ))}

          {(escrito.report.pedidos?.length ?? 0) > 0 && (
            <>
              <h3>Pedidos</h3>
              <ol className="small">
                {escrito.report.pedidos?.map((pedido) => <li key={pedido}>{pedido}</li>)}
              </ol>
            </>
          )}

          {(escrito.report.citas?.length ?? 0) > 0 && (
            <>
              <h3>Citas verificadas</h3>
              <table>
                <thead>
                  <tr>
                    <th>Texto</th>
                    <th>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {escrito.report.citas?.map((cita) => (
                    <tr key={`${cita.fuente}-${cita.texto.slice(0, 24)}`}>
                      <td className="small">{cita.texto}</td>
                      <td className="mono small">{cita.fuente}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {(escrito.report.comprobar_antes?.length ?? 0) > 0 && (
            <>
              <h3>Comprobar antes de presentar</h3>
              <ul className="small">
                {escrito.report.comprobar_antes?.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}

          {(escrito.report.avisos?.length ?? 0) > 0 && (
            <ul className="small muted">
              {escrito.report.avisos?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <p className="small muted">
            {escrito.analysis?.generated_at
              ? `Generado el ${new Date(escrito.analysis.generated_at).toLocaleString("es-ES")}`
              : ""}
            {escrito.analysis?.model ? ` · modelo ${escrito.analysis.model}` : ""}
            {typeof escrito.analysis?.cost === "number"
              ? ` · coste $${escrito.analysis.cost.toFixed(4)}`
              : ""}
            {(escrito.analysis?.leyes?.length ?? 0) > 0
              ? ` · normas usadas: ${escrito.analysis?.leyes?.join(", ")}`
              : ""}
          </p>
        </div>
      )}

      {sentencias.length > 0 && (
        <div className="section">
          <h2>Sentencias citadas en este texto</h2>
          <p className="small muted">
            Detectadas por reglas en el propio PDF y cruzadas con tu corpus de sentencias.
          </p>
          <table>
            <thead>
              <tr>
                <th>Cita</th>
                <th>¿La tienes?</th>
              </tr>
            </thead>
            <tbody>
              {sentencias.map((item) => (
                <tr key={`${item.roj}-${item.raw.slice(0, 24)}`}>
                  <td className="small">
                    <strong>{item.raw}</strong>
                    {item.tipo !== "SENTENCIA" && (
                      <div className="mono small muted">{item.roj}</div>
                    )}
                  </td>
                  <td className="small">
                    {item.enCorpus && item.caseId ? (
                      <Link href={`/cases/${item.caseId}`}>
                        {item.caseId.replace("case_", "")} {item.ecli ? `· ${item.ecli}` : ""}
                      </Link>
                    ) : (
                      <span className="badge">no está en tu corpus</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doctrina.length > 0 && (
        <div className="section">
          <h2>Doctrina citada por las partes</h2>
          <p className="small muted">
            Sentencias que se citan en el propio texto, con la frase citada. Si ya la tienes en el
            corpus, la enlazamos: es doctrina que puedes leer entera y reutilizar.
          </p>
          <table>
            <thead>
              <tr>
                <th>Cita</th>
                <th style={{ width: 110 }}>Fecha</th>
                <th>Papel en el asunto</th>
                <th>¿En tu corpus?</th>
              </tr>
            </thead>
            <tbody>
              {doctrina.map((cita) => (
                <tr key={cita.ref}>
                  <td className="small">
                    <strong>{cita.ref}</strong>
                    {cita.quote && <div className="muted">«{cita.quote}…»</div>}
                  </td>
                  <td className="mono small">{cita.date || "—"}</td>
                  <td className="small">
                    {PAPELES[cita.role] ?? cita.role.replace(/_/g, " ").toLowerCase()}
                  </td>
                  <td className="small">
                    {cita.enCorpus && cita.caseId ? (
                      <Link href={`/cases/${cita.caseId}`}>sí, está →</Link>
                    ) : (
                      <span className="muted">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="section">
        <summary style={{ cursor: "pointer", fontSize: 18, fontWeight: 600 }}>
          Leyes citadas
        </summary>
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
      </details>

      {vigencias.length > 0 && (
        <div className="section">
          <h2>Vigencia de las leyes citadas</h2>
          <p className="small muted">
            Compara la fecha de la sentencia con la versión vigente de cada artículo citado: si la
            versión actual es posterior, el texto puede haber cambiado desde la sentencia.
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
                  <td className="small">
                    <Link href={`/laws/${item.boe_id}?block=${item.block_id}`}>{item.norma}</Link>
                  </td>
                  <td className="mono small">{fechaEs(item.version_en_sentencia)}</td>
                  <td className="small">
                    {item.cambio_posterior ? (
                      <>
                        <span className="badge warn">
                          cambió después ({fechaEs(item.version_actual)})
                        </span>{" "}
                        {item.version_en_sentencia && (
                          <Link
                            href={`/laws/${item.boe_id}?block=${item.block_id}&version=${item.version_en_sentencia}`}
                          >
                            ver texto vigente entonces
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="badge ok">sin cambios</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actividadCaso.length > 0 && (
        <div className="section">
          <h2>Actividad de este caso</h2>
          <p className="small muted">
            Entradas de <span className="mono">data/audit.log</span> con este caso (compartir,
            revisar, archivar, subir).
          </p>
          <table>
            <thead>
              <tr>
                <th style={{ width: 170 }}>Cuándo</th>
                <th>Quién</th>
                <th>Qué</th>
              </tr>
            </thead>
            <tbody>
              {actividadCaso.map((entrada, index) => (
                <tr key={`${entrada.at}-${index}`}>
                  <td className="small mono">
                    {entrada.at ? new Date(entrada.at).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="small">{userLabels.get(entrada.actor) ?? entrada.actor}</td>
                  <td className="small">{label(AUDIT, entrada.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="section">
        <summary style={{ cursor: "pointer", fontSize: 18, fontWeight: 600 }}>
          Trazabilidad de la extracción
        </summary>
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
      </details>
    </>
  );
}
