import Link from "next/link";
import { redirect } from "next/navigation";
import { canViewCase, contextoVisibilidad } from "@/lib/auth";
import {
  filtrarFrasesDelTema,
  getClientes,
  getContradicciones,
  getGruposFrases,
  getVigenciaAlerts,
  listCases,
} from "@/lib/dataset";
import { OUTCOME, REVIEW, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";
import { cortar } from "@/lib/texto";

export const dynamic = "force-dynamic";

export default async function ClientePage({ params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;
  const { actor, orgId, grants } = await contextoVisibilidad();

  const [clientes, todos] = await Promise.all([getClientes(), listCases()]);
  const casos = todos.filter(
    (caso) => clientes[caso.id] === nombre && canViewCase(actor, caso.id, orgId, grants),
  );
  if (casos.length === 0) redirect("/clientes");

  const ids = new Set(casos.map((caso) => caso.id));
  const [grupos, vigencia, contradictorio] = await Promise.all([
    getGruposFrases(),
    getVigenciaAlerts(),
    getContradicciones(),
  ]);
  const frases = filtrarFrasesDelTema(grupos, ids);
  const alertasLey = vigencia
    .map((alerta) => ({ ...alerta, casos: alerta.casos.filter((caso) => ids.has(caso.caseId)) }))
    .filter((alerta) => alerta.casos.length > 0)
    .slice(0, 6);
  const divididos = contradictorio
    .map((tema) => ({ ...tema, ejemplos: tema.ejemplos.filter((ejemplo) => ids.has(ejemplo.caseId)) }))
    .filter((tema) => tema.ejemplos.length > 0)
    .slice(0, 6);

  const revisados = casos.filter((caso) => caso.reviewStatus !== "UNREVIEWED").length;
  const pendientes = casos.length - revisados;
  const distribucion: Record<string, number> = {};
  for (const caso of casos) distribucion[caso.outcome] = (distribucion[caso.outcome] ?? 0) + 1;
  const ultimo = casos
    .map((caso) => caso.generatedAt.slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <>
      <p className="small muted">
        <Link href="/clientes">← Clientes</Link> ·{" "}
        <Link href={`/cases?cliente=${encodeURIComponent(nombre)}`}>filtrar en /cases</Link>
      </p>

      <h1>{nombre}</h1>

      <div className="grid">
        <div className="card">
          <div className="value">{casos.length}</div>
          <div className="label">casos</div>
        </div>
        <div className="card">
          <div className="value">{revisados}</div>
          <div className="label">revisados</div>
        </div>
        <div className="card">
          <div className="value">{pendientes}</div>
          <div className="label">pendientes</div>
        </div>
        <div className="card">
          <div className="value" style={{ fontSize: 18 }}>{ultimo || "—"}</div>
          <div className="label">último analizado</div>
        </div>
      </div>

      <p className="small">
        {Object.entries(distribucion)
          .sort((a, b) => b[1] - a[1])
          .map(([outcome, cantidad]) => `${label(OUTCOME, outcome)}: ${cantidad}`)
          .join(" · ")}
      </p>

      <div className="section">
        <h2>Casos</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Analizado</th>
              <th>Asunto</th>
              <th style={{ width: 150 }}>Resultado</th>
              <th style={{ width: 140 }}>Revisión</th>
            </tr>
          </thead>
          <tbody>
            {[...casos]
              .sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))
              .map((caso) => (
                <tr key={caso.id}>
                  <td className="mono small">{caso.generatedAt.slice(0, 10) || "—"}</td>
                  <td className="small">
                    <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                  </td>
                  <td>
                    <OutcomeBadge outcome={caso.outcome} />
                  </td>
                  <td className="small">
                    <span
                      className={`badge ${caso.reviewStatus === "UNREVIEWED" ? "warn" : "ok"}`}
                    >
                      {label(REVIEW, caso.reviewStatus)}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {frases.length > 0 && (
        <div className="section">
          <h2>Frases que se repiten en estos casos</h2>
          <ul className="small">
            {frases.map((grupo) => (
              <li key={grupo.ejemplo} style={{ marginBottom: 6 }}>
                <Link href={`/patrones/frase?e=${encodeURIComponent(grupo.ejemplo)}`}>
                  «{cortar(grupo.ejemplo, 110)}»
                </Link>{" "}
                <span className={`badge ${grupo.homogenea >= 90 ? "ok" : "warn"}`}>
                  {grupo.homogenea}% igual
                </span>{" "}
                <span className="badge">{grupo.total} casos</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {alertasLey.length > 0 && (
        <div className="section">
          <h2>Leyes citadas que han cambiado</h2>
          <ul className="small">
            {alertasLey.map((alerta) => (
              <li key={`${alerta.boe_id}-${alerta.block_id}`}>
                {alerta.norma} {alerta.titulo} — {alerta.resumen}…{" "}
                <span className="muted">({alerta.casos.length} de tus casos)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {divididos.length > 0 && (
        <div className="section">
          <h2>Temas con criterio dividido</h2>
          <ul className="small">
            {divididos.map((tema) => (
              <li key={tema.topic}>
                <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link> —{" "}
                {tema.estimados} estimados / {tema.desestimados} desestimados
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="small muted">
        Ficha de cliente generada sobre tus casos visibles; los análisis de IA siguen pendientes de
        revisión profesional.
      </p>
    </>
  );
}
