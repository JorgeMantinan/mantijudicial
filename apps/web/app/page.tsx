import Link from "next/link";
import { requireActor, canViewCase, defaultOrgId } from "@/lib/auth";
import { computePatterns, getEvalReport, getLawUsage, listCases, listLaws } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";

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

  const [usage, patterns, laws, evalReport] = await Promise.all([
    getLawUsage(caseIds),
    computePatterns(caseIds),
    listLaws(),
    getEvalReport(),
  ]);

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

      <h2>Resultados (casación)</h2>
      <table>
        <thead>
          <tr>
            <th>Resultado</th>
            <th>Casos</th>
          </tr>
        </thead>
        <tbody>
          {outcomes.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.count}</td>
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
          </tr>
        </thead>
        <tbody>
          {branches.map((row) => (
            <tr key={row.name}>
              <td>
                <Link href={`/cases?branch=${encodeURIComponent(row.name)}`}>{row.name}</Link>
              </td>
              <td>{row.count}</td>
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
        El informe completo se genera con <span className="mono">pnpm run eval</span> →{" "}
        <span className="mono">cases/eval_report.json</span>.
      </p>
    </>
  );
}
