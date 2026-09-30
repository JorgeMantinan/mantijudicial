import Link from "next/link";
import { Bar } from "@/components/bar";
import { requireActor, canViewCase, defaultOrgId } from "@/lib/auth";
import { computePatterns, getEvalReport, getLawUsage, getReviewStats, getVigenciaAlerts, listCases, listLaws } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, OUTCOME, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

function groupCount(values: string[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export default async function Home() {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const all = await listCases();
  const cases = all.filter((item) => canViewCase(actor, item.id, orgId, grants));
  const caseIds = cases.map((item) => item.id);

  const [usage, patterns, laws, evalReport, reviewStats, vigencia] = await Promise.all([
    getLawUsage(caseIds),
    computePatterns(caseIds),
    listLaws(),
    getEvalReport(),
    getReviewStats(),
    getVigenciaAlerts(),
  ]);

  const pendientes = reviewStats.pending.filter((item) => canViewCase(actor, item.id, orgId, grants));
  const leyesCambiadas = vigencia.filter((alerta) =>
    alerta.casos.some((caso) => canViewCase(actor, caso.caseId, orgId, grants)),
  ).length;

  const cross = evalReport?.cross_check_outcome as
    | { agreement?: number; total?: number; agreement_rate?: number }
    | undefined;
  const cit = evalReport?.citations as
    | { verified?: number; total?: number; verified_rate?: number; pdf_cross_check?: { matched?: number; checkable?: number } }
    | undefined;
  const gold = evalReport?.golden as
    | { entries?: number; passed?: number; fields?: number; confirmed_entries?: number }
    | undefined;

  const outcomes = groupCount(cases.map((item) => item.outcome));
  const branches = groupCount(cases.map((item) => item.branch));
  const analyzed = patterns?.cases_analyzed ?? 0;

  return (
    <>
      <h1>Corpus jurídico</h1>
      <p className="lead">
        Sentencias estructuradas por IA, cruzadas con el texto consolidado del BOE y agregadas en
        patrones de resultado.
      </p>

      <div className="grid">
        <div className="card">
          <div className="value">{cases.length}</div>
          <div className="label">casos visibles para ti</div>
        </div>
        <div className="card">
          <div className="value">{cases.filter((item) => item.enriched).length}</div>
          <div className="label">enriquecidos con IA</div>
        </div>
        <div className="card">
          <div className="value">{laws.length}</div>
          <div className="label">normas BOE con texto</div>
        </div>
        <div className="card">
          <div className="value">{analyzed}</div>
          <div className="label">casos con patrones</div>
        </div>
      </div>

      <div className="section">
        <h2>Accesos directos</h2>
        <ul className="small">
          <li>
            <Link href="/alertas">Alertas</Link> — {leyesCambiadas} leyes cambiadas tras tus
            sentencias y {pendientes.length} casos sin revisar
          </li>
          <li>
            <Link href="/review">Revisión humana</Link>
            {reviewStats.next ? (
              <>
                {" "}
                — siguiente pendiente:{" "}
                <Link href={`/cases/${reviewStats.next.id}`}>{reviewStats.next.id}</Link>
              </>
            ) : (
              " — todo revisado"
            )}
          </li>
          <li>
            <Link href="/informes">Informe del periodo</Link> — sentencias, temas y normas del mes,
            listo para imprimir
          </li>
          <li>
            <Link href="/search">Búsqueda</Link> — texto libre o identificador exacto (ECLI, ROJ, nº
            de recurso)
          </li>
          <li>
            <Link href="/plazos">Plazos procesales</Link> — cómputo con la LEC verificada contra el
            BOE
          </li>
          <li>
            <Link href="/novedades">Novedades</Link> — qué se ha ido añadiendo a la plataforma
          </li>
        </ul>
      </div>

      <h2>Resultados (casación)</h2>
      <table>
        <thead>
          <tr>
            <th>Resultado</th>
            <th>Casos</th>
            <th style={{ width: 180 }}>Proporción</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((row) => (
            <tr key={row.name}>
              <td title={row.name}>{label(OUTCOME, row.name)}</td>
              <td>{row.count}</td>
              <td>
                <Bar
                  value={row.count}
                  max={outcomes[0]?.count ?? 1}
                  tone={
                    row.name === "ESTIMED"
                      ? "ok"
                      : row.name === "DISMISSED"
                        ? "ko"
                        : "accent"
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Ramas del derecho</h2>
      <table>
        <thead>
          <tr>
            <th>Rama</th>
            <th>Casos</th>
            <th style={{ width: 180 }}>Proporción</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((row) => (
            <tr key={row.name}>
              <td title={row.name}>
                <Link href={`/cases?branch=${encodeURIComponent(row.name)}`}>
                  {label(BRANCH, row.name)}
                </Link>
              </td>
              <td>{row.count}</td>
              <td>
                <Bar value={row.count} max={branches[0]?.count ?? 1} tone="accent" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Normas más citadas en tus casos</h2>
      <table>
        <thead>
          <tr>
            <th>Norma</th>
            <th>Citas</th>
            <th>Casos</th>
          </tr>
        </thead>
        <tbody>
          {usage.byNorm.slice(0, 8).map((row) => (
            <tr key={row.boe_id}>
              <td>
                <Link href={`/laws/${row.boe_id}`}>{row.titulo}</Link>
              </td>
              <td>{row.citations}</td>
              <td>{row.cases.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Artículos más citados</h2>
      <table>
        <thead>
          <tr>
            <th>Artículo</th>
            <th>Norma</th>
            <th>Citas</th>
            <th>Casos</th>
          </tr>
        </thead>
        <tbody>
          {usage.byArticle.slice(0, 8).map((row) => (
            <tr key={`${row.boe_id}-${row.article}`}>
              <td className="mono">art. {row.article}</td>
              <td className="small">{row.titulo}</td>
              <td>{row.citations}</td>
              <td>{row.cases.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="notice">
        Estas cifras son <strong>asociaciones observadas</strong> en el corpus disponible, no
        predicciones. La revisión de un abogado es imprescindible.
      </div>

      <h2>Evaluación (pnpm eval)</h2>
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Salida (casación) frente a la parte dispositiva del PDF</td>
            <td>
              {cross?.agreement ?? 0}/{cross?.total ?? 0}
              {cross?.agreement_rate !== undefined
                ? ` (${(cross.agreement_rate * 100).toFixed(1)}%)`
                : ""}
            </td>
          </tr>
          <tr>
            <td>Citas de leyes verificadas contra el BOE</td>
            <td>
              {cit?.verified ?? 0}/{cit?.total ?? 0}
              {cit?.verified_rate !== undefined ? ` (${(cit.verified_rate * 100).toFixed(1)}%)` : ""}
            </td>
          </tr>
          <tr>
            <td>Siglas citadas presentes en el propio PDF</td>
            <td>
              {cit?.pdf_cross_check?.matched ?? 0}/{cit?.pdf_cross_check?.checkable ?? 0}
            </td>
          </tr>
          <tr>
            <td>Golden dataset (campos correctos)</td>
            <td>
              {gold?.passed ?? 0}/{gold?.fields ?? 0} · {gold?.entries ?? 0} entradas (
              {gold?.confirmed_entries ?? 0} confirmadas)
            </td>
          </tr>
        </tbody>
      </table>
      <p className="small muted">
        <Link href="/eval">Ver el informe completo (corpus, coste de IA, citas y golden dataset) →</Link>
      </p>
    </>
  );
}
