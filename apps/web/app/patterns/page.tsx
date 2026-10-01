import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { PrintButton } from "@/components/print-button";
import { computePatterns, getContradicciones, getGruposFrases, listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { ARG_OUTCOME, ARG_TYPE, BRANCH, OUTCOME, SIDE, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DISCLAIMER =
  "Asociaciones observadas en el corpus disponible. No son predicciones ni establecen " +
  "causalidad: solo indican con qué frecuencia aparece un elemento junto a cada resultado. " +
  "La revisión de un abogado es imprescindible.";

type Group = {
  key: string;
  cases: number;
  distribution: { total: number; counts: Record<string, number> };
  share_estimated: number | null;
};

type ArgRow = { key: string; cases: number; outcomes: Record<string, number> };
type LawRow = { boe_id: string; siglas: string[]; cases: number; outcomes: Record<string, number> };

function dist(counts: Record<string, number> | undefined, map: Record<string, string> = OUTCOME) {
  if (!counts) return "—";
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => `${map[name] ?? name} ${value}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export default async function PatternsPage() {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const cases = (await listCases()).filter((item) => canViewCase(actor, item.id, orgId, grants));
  const computed = await computePatterns(cases.map((item) => item.id));
  const gruposFrases = await getGruposFrases();
  const contradictorio = (await getContradicciones())
    .map((tema) => ({
      ...tema,
      ejemplos: tema.ejemplos.filter((ejemplo) =>
        canViewCase(actor, ejemplo.caseId, orgId, grants),
      ),
    }))
    .filter((tema) => tema.ejemplos.length > 0);
  const patterns = computed
    ? { generated_at: new Date().toISOString(), disclaimer: DISCLAIMER, ...computed }
    : null;
  if (!patterns) {
    return (
      <>
        <h1>Patrones</h1>
        <p className="muted">Todavía no hay datos de patrones. Ejecuta pnpm patterns.</p>
      </>
    );
  }

  const groups = (value: unknown): Group[] =>
    Array.isArray(value) ? (value as Group[]) : [];
  const rows = (value: unknown): ArgRow[] => (Array.isArray(value) ? (value as ArgRow[]) : []);
  const laws = (value: unknown): LawRow[] => (Array.isArray(value) ? (value as LawRow[]) : []);

  const outcomes = (patterns.outcomes as { counts?: Record<string, number>; total?: number }) ?? {};
  const branch = groups(patterns.by_branch);
  const side = groups(patterns.by_recurring_side);
  const topics = groups(patterns.by_holding_topic);
  const doctrines = groups(patterns.by_doctrine);
  const issues = groups(patterns.by_issue);
  const args = rows(patterns.by_argument_type);
  const verifiedLaws = laws(patterns.by_verified_law);

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> · <Link href="/alertas">Alertas</Link> ·{" "}
        <Link href="/temas/comparar">Comparar temas</Link>
      </p>
      <PrintButton text="Imprimir los patrones" />

      <h1>Patrones del corpus</h1>
      <p className="lead">
        {Number(patterns.cases_analyzed ?? 0)} casos analizados · soporte mínimo{" "}
        {Number(patterns.min_support ?? 0)} casos · generado{" "}
        <span className="mono">{String(patterns.generated_at ?? "")}</span>
      </p>

      <div className="notice">{String(patterns.disclaimer ?? "")}</div>

      <div className="grid">
        {Object.entries(outcomes.counts ?? {})
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => (
            <div className="card" key={name}>
              <div className="value">{count}</div>
              <div className="label">{name}</div>
            </div>
          ))}
      </div>

      <div className="section">
        <h2>Frases que se repiten (y cómo se resolvió)</h2>
        <p className="small muted">
          Agrupamos frases parecidas de los hechos y de los fundamentos de distintos casos y vemos
          cómo acabó cada uno. Solo salen grupos <strong>homogéneos</strong> (≥70% de los casos con
          el mismo resultado) y sin frases de cajón como «desestimó el recurso», que están en casi
          todos los juicios. Sirve para ver qué relatos acompañan a estimar o desestimar: es una{" "}
          <strong>asociación</strong>, no una predicción.
        </p>
        {gruposFrases.length === 0 ? (
          <p className="small muted">
            Todavía no hay frases repetidas en al menos 3 casos (hace falta más corpus o enunciados
            más largos).
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Frase (ejemplo)</th>
                <th>Casos</th>
                <th>Se repite el resultado</th>
                <th>Cómo acabaron</th>
                <th>Fichas</th>
              </tr>
            </thead>
            <tbody>
              {gruposFrases.map((grupo) => (
                <tr key={grupo.ejemplo}>
                  <td className="small">«{grupo.ejemplo}»</td>
                  <td>
                    <span className="badge">{grupo.total}</span>
                  </td>
                  <td>
                    <span className={`badge ${grupo.homogenea >= 90 ? "ok" : "warn"}`}>
                      {grupo.homogenea}% igual
                    </span>
                  </td>
                  <td className="small">
                    {Object.entries(grupo.distribucion).map(([outcome, cantidad]) => (
                      <span
                        key={outcome}
                        className={`badge ${outcome === "ESTIMED" ? "ok" : outcome === "DISMISSED" ? "ko" : "warn"}`}
                        style={{ marginRight: 4 }}
                      >
                        {label(OUTCOME, outcome)} {cantidad}
                      </span>
                    ))}
                  </td>
                  <td className="small">
                    {grupo.casos.slice(0, 4).map((caso) => (
                      <Link
                        key={caso.caseId}
                        href={`/cases/${caso.caseId}`}
                        style={{ marginRight: 8 }}
                        title={caso.headline}
                      >
                        {caso.caseId.replace("case_", "")}
                      </Link>
                    ))}
                    {grupo.casos.length > 4 && <span className="muted">+{grupo.casos.length - 4}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {contradictorio.length > 0 && (
        <>
          <h2>Temas con criterio dividido</h2>
          <p className="small muted">
            Mismo tema, resultados opuestos: son los casos donde el tribunal ha resuelto en un
            sentido y en otro. Útil para saber qué argumento es arriesgado. Es una{" "}
            <strong>asociación</strong>, no una predicción.
          </p>
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                <th>Casos</th>
                <th>Estimados</th>
                <th>Desestimados</th>
                <th>Ejemplos</th>
              </tr>
            </thead>
            <tbody>
              {contradictorio.map((item) => (
                <tr key={item.topic}>
                  <td>
                    <Link href={`/temas/${encodeURIComponent(item.topic)}`}>
                      {item.topic}
                    </Link>
                  </td>
                  <td>{item.cases}</td>
                  <td>
                    <span className="badge ok">{item.estimados}</span>
                  </td>
                  <td>
                    <span className="badge ko">{item.desestimados}</span>
                  </td>
                  <td className="small">
                    {item.ejemplos.slice(0, 3).map((ejemplo) => (
                      <div key={ejemplo.caseId}>
                        <span className="mono">{ejemplo.caseId.replace("case_", "")}</span>{" "}
                        <OutcomeBadge outcome={ejemplo.outcome} />{" "}
                        {ejemplo.headline.length > 70
                          ? `${ejemplo.headline.slice(0, 70)}…`
                          : ejemplo.headline}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Resultado por rama del derecho</h2>
      <table>
        <thead>
          <tr>
            <th>Rama</th>
            <th>Casos</th>
            <th>Distribución</th>
            <th>% estimaciones</th>
          </tr>
        </thead>
        <tbody>
          {branch.map((group) => (
            <tr key={group.key}>
              <td title={group.key}>{label(BRANCH, group.key)}</td>
              <td>{group.cases}</td>
              <td className="small">{dist(group.distribution.counts)}</td>
              <td>{group.share_estimated === null ? "—" : `${(group.share_estimated * 100).toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Resultado según quién recurre en casación</h2>
      <table>
        <thead>
          <tr>
            <th>Recurrente</th>
            <th>Casos</th>
            <th>Distribución</th>
            <th>% estimaciones</th>
          </tr>
        </thead>
        <tbody>
          {side.map((group) => (
            <tr key={group.key}>
              <td title={group.key}>{label(SIDE, group.key)}</td>
              <td>{group.cases}</td>
              <td className="small">{dist(group.distribution.counts)}</td>
              <td>{group.share_estimated === null ? "—" : `${(group.share_estimated * 100).toFixed(0)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Temas del tribunal (ratio decidendi)</h2>
      <table>
        <thead>
          <tr>
            <th>Tema</th>
            <th>Casos</th>
            <th>Distribución</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((group) => (
            <tr key={group.key}>
              <td>{group.key}</td>
              <td>{group.cases}</td>
              <td className="small">{dist(group.distribution.counts)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Doctrina y precedentes citados</h2>
      <table>
        <thead>
          <tr>
            <th>Doctrina</th>
            <th>Casos</th>
            <th>Distribución</th>
          </tr>
        </thead>
        <tbody>
          {doctrines.map((group) => (
            <tr key={group.key}>
              <td>{group.key}</td>
              <td>{group.cases}</td>
              <td className="small">{dist(group.distribution.counts)}</td>
            </tr>
          ))}
        </tbody>
        {doctrines.length === 0 && (
          <tr>
            <td colSpan={3} className="muted">
              Ninguna doctrina alcanza el soporte mínimo.
            </td>
          </tr>
        )}
      </table>

      <h2>Argumentos por tipo</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Casos</th>
            <th>Acepción de argumentos</th>
          </tr>
        </thead>
        <tbody>
          {args.map((row) => (
            <tr key={row.key}>
              <td title={row.key}>{label(ARG_TYPE, row.key)}</td>
              <td>{row.cases}</td>
              <td className="small">{dist(row.outcomes, ARG_OUTCOME)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Normas verificadas citadas</h2>
      <table>
        <thead>
          <tr>
            <th>Norma</th>
            <th>Siglas</th>
            <th>Casos</th>
            <th>Resultados</th>
          </tr>
        </thead>
        <tbody>
          {verifiedLaws.map((row) => (
            <tr key={row.boe_id}>
              <td className="mono small">{row.boe_id}</td>
              <td className="small">{row.siglas.join(", ")}</td>
              <td>{row.cases}</td>
              <td className="small">{dist(row.outcomes)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Cuestiones planteadas</h2>
      <table>
        <thead>
          <tr>
            <th>Cuestión</th>
            <th>Casos</th>
            <th>Distribución</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((group) => (
            <tr key={group.key}>
              <td>{group.key}</td>
              <td>{group.cases}</td>
              <td className="small">{dist(group.distribution.counts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
