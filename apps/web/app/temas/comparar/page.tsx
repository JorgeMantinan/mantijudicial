import Link from "next/link";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { getEvolucion, getTema } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function CompararTemasPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const grants = await authorizationGrants();
  const sp = await searchParams;
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);

  const todos = (await getEvolucion())
    .map((tema) => ({
      ...tema,
      entries: tema.entries.filter((entry) => puedeVer(entry.caseId)),
    }))
    .filter((tema) => tema.entries.length > 0);
  const nombres = todos.map((tema) => tema.topic);
  const a = sp.a && nombres.includes(sp.a) ? sp.a : (nombres[0] ?? "");
  const b = sp.b && nombres.includes(sp.b) ? sp.b : (nombres[1] ?? "");

  const [fichaA, fichaB] = await Promise.all([getTema(a, puedeVer), getTema(b, puedeVer)]);

  const filas: Array<{ metrica: string; a: string; b: string }> = [];
  if (fichaA && fichaB) {
    const cuenta = (ficha: NonNullable<typeof fichaA>, outcome: string) =>
      ficha.tema.distribution[outcome] ?? 0;
    const aceptados = (ficha: NonNullable<typeof fichaA>) =>
      ficha.argumentos.reduce((total, arg) => total + arg.aceptados, 0);
    const normas = (ficha: NonNullable<typeof fichaA>) => ficha.leyes.length;
    filas.push(
      { metrica: "Casos", a: String(fichaA.tema.cases), b: String(fichaB.tema.cases) },
      {
        metrica: "Estimados",
        a: String(cuenta(fichaA, "ESTIMED")),
        b: String(cuenta(fichaB, "ESTIMED")),
      },
      {
        metrica: "Desestimados",
        a: String(cuenta(fichaA, "DISMISSED")),
        b: String(cuenta(fichaB, "DISMISSED")),
      },
      {
        metrica: "Primera sentencia",
        a: fichaA.tema.first.slice(0, 10),
        b: fichaB.tema.first.slice(0, 10),
      },
      {
        metrica: "Última sentencia",
        a: fichaA.tema.last.slice(0, 10),
        b: fichaB.tema.last.slice(0, 10),
      },
      { metrica: "Argumentos aceptados", a: String(aceptados(fichaA)), b: String(aceptados(fichaB)) },
      { metrica: "Normas citadas", a: String(normas(fichaA)), b: String(normas(fichaB)) },
    );
  }

  return (
    <>
      <p className="small muted no-print">
        <Link href="/evolucion">← Evolución</Link> ·{" "}
        {nombres.slice(0, 6).map((nombre) => (
          <span key={nombre} style={{ marginRight: 8 }}>
            <Link href={`/temas/${encodeURIComponent(nombre)}`}>{nombre}</Link>
          </span>
        ))}
      </p>

      <h1>Comparar dos temas</h1>
      <p className="lead">
        Dos líneas de jurisprudencia lado a lado: resultados, vigencia temporal, argumentos que
        funcionaron y normas usadas.
      </p>

      <form className="filters" action="/temas/comparar" method="get">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Tema A
          <select name="a" defaultValue={a}>
            {nombres.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Tema B
          <select name="b" defaultValue={b}>
            {nombres.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ marginTop: 18 }}>
          Comparar
        </button>
      </form>

      {fichaA && fichaB && (
        <>
          <div className="grid">
            <div className="card">
              <div className="value">{fichaA.tema.cases}</div>
              <div className="label">
                <Link href={`/temas/${encodeURIComponent(fichaA.tema.topic)}`}>{fichaA.tema.topic}</Link>
              </div>
            </div>
            <div className="card">
              <div className="value">{fichaB.tema.cases}</div>
              <div className="label">
                <Link href={`/temas/${encodeURIComponent(fichaB.tema.topic)}`}>{fichaB.tema.topic}</Link>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                <th style={{ textAlign: "right" }}>Tema A</th>
                <th style={{ textAlign: "right" }}>Tema B</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.metrica}>
                  <td className="small">{fila.metrica}</td>
                  <td className="small" style={{ textAlign: "right" }}>
                    {fila.a}
                  </td>
                  <td className="small" style={{ textAlign: "right" }}>
                    {fila.b}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="section">
            <h2>Distribución de resultados</h2>
            <p className="small">
              {[...new Set([...Object.keys(fichaA.tema.distribution), ...Object.keys(fichaB.tema.distribution)])].map(
                (outcome) => (
                  <span key={outcome} style={{ marginRight: 14 }}>
                    <strong>{label(OUTCOME, outcome)}</strong>:{" "}
                    {fichaA.tema.distribution[outcome] ?? 0} vs {fichaB.tema.distribution[outcome] ?? 0}
                  </span>
                ),
              )}
            </p>
          </div>

          <div className="section">
            <h2>Últimos casos de cada tema</h2>
            <div className="grid">
              {[fichaA, fichaB].map((ficha) => (
                <div key={ficha.tema.topic}>
                  <h3>{ficha.tema.topic}</h3>
                  <ul className="small">
                    {ficha.tema.entries.slice(-5).reverse().map((entry) => (
                      <li key={entry.caseId}>
                        <Link href={`/cases/${entry.caseId}`}>{entry.caseId.replace("case_", "")}</Link>{" "}
                        <OutcomeBadge outcome={entry.outcome} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="small muted">
        Comparación de asociaciones observadas en tu corpus: no es una predicción ni asesoramiento.
      </p>
    </>
  );
}
