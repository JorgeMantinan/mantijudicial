import Link from "next/link";
import { redirect } from "next/navigation";
import { canViewCase, requireActor , contextoVisibilidad } from "@/lib/auth";
import { getGruposFrases, listCases } from "@/lib/dataset";
import { BRANCH, INSTANCE, OUTCOME, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

/** Ficha completa de un grupo de frases: todos sus casos y cómo se resolvieron. */
export default async function FrasePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { actor, orgId, grants } = await contextoVisibilidad();
  const sp = await searchParams;
  const ejemplo = (sp.e ?? "").trim();
  if (!ejemplo) redirect("/patterns");

  const grupo = (await getGruposFrases()).find((item) => item.ejemplo === ejemplo);
  if (!grupo) redirect("/patterns");

  const ramas = new Map((await listCases()).map((item) => [item.id, item.branch]));
  const casos = grupo.casos.filter((caso) => canViewCase(actor, caso.caseId, orgId, grants));
  if (casos.length === 0) redirect("/patterns");

  return (
    <>
      <p className="small muted no-print">
        <Link href="/patterns">← Patrones</Link> · <Link href="/alertas">Alertas</Link>
      </p>

      <h1>Frase repetida entre casos</h1>
      <p className="lead">«{grupo.ejemplo}»</p>

      <p>
        <span className="badge">{grupo.origen}</span>{" "}
        <span className={`badge ${grupo.homogenea >= 90 ? "ok" : "warn"}`}>
          {grupo.homogenea}% igual
        </span>{" "}
        <span className="badge">{grupo.total} casos</span>{" "}
        {Object.entries(grupo.distribucion).map(([outcome, cantidad]) => (
          <span
            key={outcome}
            className={`badge ${outcome === "ESTIMED" ? "ok" : outcome === "DISMISSED" ? "ko" : "warn"}`}
            style={{ marginRight: 4 }}
          >
            {label(OUTCOME, outcome)} {cantidad}
          </span>
        ))}
      </p>

      <p className="small muted">
        Ramas:{" "}
        {Object.entries(grupo.ramas)
          .sort((a, b) => b[1] - a[1])
          .map(([rama, cantidad]) => `${label(BRANCH, rama)} (${cantidad})`)
          .join(" · ")}
      </p>

      {grupo.instancias.length > 0 && (
        <div className="section">
          <h2>Cómo se resolvió por instancia</h2>
          <table>
            <thead>
              <tr>
                <th>Instancia</th>
                <th>Favor demandante</th>
                <th>Favor demandado</th>
                <th>Parcial</th>
              </tr>
            </thead>
            <tbody>
              {grupo.instancias.map((instancia) => (
                <tr key={instancia.instancia}>
                  <td className="small">{label(INSTANCE, instancia.instancia)}</td>
                  <td>{instancia.demandante}</td>
                  <td>{instancia.demandado}</td>
                  <td>{instancia.parcial}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2>Los {casos.length} casos con esta frase</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Caso</th>
              <th>Asunto</th>
              <th style={{ width: 150 }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {casos.map((caso) => (
              <tr key={caso.caseId}>
                <td className="mono small">
                  <Link href={`/cases/${caso.caseId}`}>{caso.caseId.replace("case_", "")}</Link>
                </td>
                <td className="small">{caso.headline}</td>
                <td>
                  <OutcomeBadge outcome={caso.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="small muted">
        Cada caso muestra su resultado en casación; el desglose por instancia es el conjunto de los
        {grupo.total} casos. Asociación observada, no predicción.
      </p>
    </>
  );
}
