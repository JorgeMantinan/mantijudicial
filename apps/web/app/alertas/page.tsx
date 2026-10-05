import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { CopyButton } from "@/components/copy-button";
import { FiltroAlertas } from "./filtro-alertas";
import { canViewCase, requireActor , contextoVisibilidad } from "@/lib/auth";
import { filtrarFrasesDelTema, getBusquedas, getCalidadCorpus, getContradicciones, getDuplicados, getGruposFrases, getHistorialAlertas, getPatronesVistos, getReviewStats, getVigenciaAlerts, diasSinTocar, listCases, registrarAlertasDelDia, runSearch } from "@/lib/dataset";
import { MarcarVistoButton, RestaurarPatronesButton } from "@/components/patron-visto";
import { ResolvedorDuplicado } from "@/components/resolvedor-duplicado";
import { jobs } from "@/lib/jobs";
import { SortTh } from "@/lib/sort-th";
import { cortar } from "@/lib/texto";

export const dynamic = "force-dynamic";

function fecha(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("es-ES");
}

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const sp = await searchParams;
  const sortKey = sp.sort ?? "";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const factor = dir === "desc" ? -1 : 1;
  const cmpTexto = (a: string, b: string) => a.localeCompare(b, "es") * factor;
  const cmpNumero = (a: number, b: number) => (a - b) * factor;
  const { actor, orgId, grants } = await contextoVisibilidad();
  const puedeVer = (caseId: string) => canViewCase(actor, caseId, orgId, grants);

  const [vigenciaBruta, contradictorioBruto, reviewBruto, calidad] = await Promise.all([
    getVigenciaAlerts(),
    getContradicciones(),
    getReviewStats(),
    getCalidadCorpus(),
  ]);
  const vigencia = vigenciaBruta
    .map((alerta) => ({ ...alerta, casos: alerta.casos.filter((caso) => puedeVer(caso.caseId)) }))
    .filter((alerta) => alerta.casos.length > 0);
  const contradictorio = contradictorioBruto
    .map((tema) => ({
      ...tema,
      ejemplos: tema.ejemplos.filter((ejemplo) => puedeVer(ejemplo.caseId)),
    }))
    .filter((tema) => tema.ejemplos.length > 0);

  const vigenciaOrden = [...vigencia].sort((a, b) => {
    if (sortKey === "vig-norma") {
      const clave = (item: { boe_id: string; article: number }) => {
        const match = /(\d{4})-(\d+)/.exec(item.boe_id);
        const anio = match ? match[1] : "0000";
        const numero = match ? match[2].padStart(6, "0") : "000000";
        return `${anio}${numero}-${String(item.article).padStart(6, "0")}`;
      };
      return cmpTexto(clave(a), clave(b));
    }
    if (sortKey === "vig-casos") return cmpNumero(a.casos.length, b.casos.length);
    return b.casos.length - a.casos.length;
  });
  const temasOrden = [...contradictorio].sort((a, b) => {
    if (sortKey === "tem-tema") return cmpTexto(a.topic, b.topic);
    if (sortKey === "tem-estimados") return cmpNumero(a.estimados, b.estimados);
    if (sortKey === "tem-desestimados") return cmpNumero(a.desestimados, b.desestimados);
    return b.estimados + b.desestimados - (a.estimados + a.desestimados);
  });
  const review = {
    ...reviewBruto,
    pending: reviewBruto.pending.filter((item) => puedeVer(item.id)),
  };
  const stale = calidad.stale.filter(puedeVer);
  const escaneados = calidad.escaneados.filter(puedeVer);
  const fallos = jobs
    .list()
    .filter((job) => job.status === "error")
    .slice()
    .reverse();

  const [todos, gruposFrases, patronesVistos, guardadas, duplicadosBruto] = await Promise.all([
    listCases(),
    getGruposFrases(),
    getPatronesVistos(actor.orgId),
    getBusquedas(actor.orgId),
    getDuplicados(),
  ]);

  const visibles = new Set(todos.filter((item) => puedeVer(item.id)).map((item) => item.id));
  const emergentes = filtrarFrasesDelTema(gruposFrases, visibles).filter(
    (grupo) => grupo.homogenea >= 90 && grupo.total <= 4,
  );

  const vistos = new Set(patronesVistos);
  const ocultos = emergentes.filter((grupo) => vistos.has(grupo.ejemplo)).length;
  const visiblesEmergentes = emergentes.filter((grupo) => !vistos.has(grupo.ejemplo));

  // Búsquedas guardadas que dan resultado en casos incorporados en los últimos 30 días.
  const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const nuevosIds = new Set(
    todos
      .filter((item) => puedeVer(item.id) && (item.generatedAt ?? "").slice(0, 10) >= hace30)
      .map((item) => item.id),
  );
  const busquedasMatch: Array<{ nombre: string; q: string; casos: string[] }> = [];
  if (nuevosIds.size > 0) {
    // Las ≤8 búsquedas se lanzan juntas (cada una es barata desde que los
    // snippets solo se calculan para los top).
    const resultados = await Promise.all(
      guardadas.slice(0, 8).map(async (busqueda) => ({
        busqueda,
        resultado: await runSearch(busqueda.q, {
          limit: 15,
          kinds: busqueda.kind ? [busqueda.kind] : undefined,
          allow: (doc) => doc.kind === "case",
        }),
      })),
    );
    for (const { busqueda, resultado } of resultados) {
      const coincidentes = [
        ...new Set(
          resultado.hits.map((hit) => hit.id.split("#")[0]).filter((id) => nuevosIds.has(id)),
        ),
      ];
      if (coincidentes.length > 0) {
        busquedasMatch.push({
          nombre: busqueda.nombre,
          q: busqueda.q,
          casos: coincidentes.slice(0, 4),
        });
      }
    }
  }
  const nuevosMatch = busquedasMatch.reduce((total, item) => total + item.casos.length, 0);
  const duplicados = duplicadosBruto
    .map((dup) => ({ ...dup, casos: dup.casos.filter(puedeVer) }))
    .filter((dup) => dup.casos.length > 1);

  const frios = todos
    .filter(
      (item) =>
        puedeVer(item.id) && item.reviewStatus === "UNREVIEWED" && diasSinTocar(item) > 30,
    )
    .sort((a, b) => diasSinTocar(b) - diasSinTocar(a));

  const total =
    contradictorio.length +
    vigencia.length +
    review.pending.length +
    fallos.length +
    stale.length +
    escaneados.length +
    visiblesEmergentes.length +
    nuevosMatch +
    duplicados.length;

  await registrarAlertasDelDia({
    fecha: new Date().toISOString().slice(0, 10),
    total,
    vigencia: vigencia.length,
    dividido: contradictorio.length,
    calidad: stale.length + escaneados.length,
    emergentes: visiblesEmergentes.length,
  });
  const historial = (await getHistorialAlertas()).slice(-14);

  const resumenAlertas = [
    `Alertas MantiJudicial · total ${total}`,
    `Leyes cambiadas: ${vigencia.length} · Criterio dividido: ${contradictorio.length}`,
    `PDFs con problemas: ${stale.length} stale, ${escaneados.length} sin texto`,
    `Pendientes de revisar: ${review.pending.length} · Casos fríos >30d: ${frios.length}`,
    `Duplicados: ${duplicados.length} · Patrones emergentes: ${visiblesEmergentes.length} · Nuevos en tus búsquedas: ${nuevosMatch}`,
  ].join("\n");

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        <Link href="/">← Resumen</Link> ·{" "}
        <a href="/api/export/alertas">descargar CSV</a> ·{" "}
        <CopyButton texto={resumenAlertas} etiqueta="Copiar resumen" />
      </p>
      <PrintButton text="Imprimir el informe de alertas" />

      <h1>Alertas</h1>
      <p className="lead">
        Señales que piden atención de un letrado: leyes que cambiaron después de tus sentencias,
        temas con criterio dividido, casos sin revisar y trabajos fallidos.{" "}
        <strong>{total} en total.</strong>
      </p>

      <FiltroAlertas />

      <div className="section">
        <h2>Leyes que cambiaron después de la sentencia</h2>
        <p className="small muted">
          El artículo citado por el tribunal tiene hoy una versión distinta: si te apoyas en esa
          cita, comprueba la versión vigente.
        </p>
        {vigencia.length === 0 ? (
          <p className="small">Ninguna alerta: las leyes citadas no han cambiado desde tus sentencias.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh
                  path="/alertas"
                  sortKey="vig-norma"
                  current={sortKey}
                  dir={dir}
                  label="Norma y artículo"
                />
                <th>Versión en la sentencia</th>
                <th>Versión actual</th>
                <SortTh
                  path="/alertas"
                  sortKey="vig-casos"
                  current={sortKey}
                  dir={dir}
                  label="Casos afectados"
                />
              </tr>
            </thead>
            <tbody>
              {vigenciaOrden.map((alerta) => (
                <tr key={`${alerta.boe_id}-${alerta.block_id}`}>
                  <td className="small">
                    <strong>
                      {alerta.norma} {alerta.titulo}
                    </strong>
                    <div className="mono small muted">{alerta.boe_id}</div>
                    <div className="muted">{alerta.resumen}…</div>
                  </td>
                  <td className="small">{alerta.casos[0]?.version_en_sentencia ?? "—"}</td>
                  <td className="small">
                    <span className="badge warn">{alerta.version_actual}</span>
                  </td>
                  <td className="small">
                    {alerta.casos.slice(0, 3).map((caso, index) => (
                      <div key={caso.caseId}>
                        <Link href={`/cases/${caso.caseId}`}>
                          {cortar(caso.headline, 60)}
                        </Link>
                        {caso.fecha_sentencia ? ` · ${caso.fecha_sentencia}` : ""}
                      </div>
                    ))}
                    {alerta.casos.length > 3 && (
                      <div className="muted">+{alerta.casos.length - 3} más</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Temas con criterio dividido</h2>
        <p className="small muted">
          El mismo tema resuelto en sentidos opuestos: saber qué argumento es arriesgado. Es una
          asociación, no una predicción.
        </p>
        {contradictorio.length === 0 ? (
          <p className="small">Ningún tema con el criterio dividido de momento.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh
                  path="/alertas"
                  sortKey="tem-tema"
                  current={sortKey}
                  dir={dir}
                  label="Tema"
                />
                <SortTh
                  path="/alertas"
                  sortKey="tem-estimados"
                  current={sortKey}
                  dir={dir}
                  label="Estimados"
                />
                <SortTh
                  path="/alertas"
                  sortKey="tem-desestimados"
                  current={sortKey}
                  dir={dir}
                  label="Desestimados"
                />
                <th>Ejemplos</th>
              </tr>
            </thead>
            <tbody>
              {temasOrden.map((tema) => (
                <tr key={tema.topic}>
                  <td>
                    <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link>
                  </td>
                  <td>
                    <span className="badge ok">{tema.estimados}</span>
                  </td>
                  <td>
                    <span className="badge ko">{tema.desestimados}</span>
                  </td>
                  <td className="small">
                    {tema.ejemplos.slice(0, 2).map((ejemplo) => (
                      <div key={ejemplo.caseId}>
                        <Link href={`/cases/${ejemplo.caseId}`}>
                          {ejemplo.headline.length > 55
                            ? `${ejemplo.headline.slice(0, 55)}…`
                            : ejemplo.headline}
                        </Link>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Casos pendientes de revisión</h2>
        {review.pending.length === 0 ? (
          <p className="small">Todo revisado.</p>
        ) : (
          <>
            <p className="small muted">
              {review.pending.length} casos enriquecidos sin revisar de {review.total}.
            </p>
            <ul className="small">
              {review.pending.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <Link href={`/cases/${item.id}`}>{item.headline}</Link>
                </li>
              ))}
            </ul>
            <p className="small">
              <Link href="/review">Ir al panel de revisión →</Link>
            </p>
          </>
        )}
      </div>

      {busquedasMatch.length > 0 && (
        <div className="section">
          <h2>Casos nuevos que encajan con tus búsquedas</h2>
          <p className="small muted">
            De los casos incorporados en los últimos 30 días, los que aparecen en tus búsquedas
            guardadas (y que todavía no habrás visto).
          </p>
          <ul className="small">
            {busquedasMatch.map((item) => (
              <li key={item.nombre} style={{ marginBottom: 6 }}>
                <strong>{item.nombre}</strong> <span className="muted">({item.q})</span> —{" "}
                {item.casos.map((caseId) => (
                  <Link key={caseId} href={`/cases/${caseId}`} style={{ marginRight: 6 }}>
                    {caseId.replace("case_", "")}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(visiblesEmergentes.length > 0 || ocultos > 0) && (
        <div className="section">
          <h2>Patrones emergentes (por vigilar)</h2>
          <p className="small muted">
            Frases con ≥90% de los casos acabando igual pero con pocos casos (3-4): pueden ser un
            patrón real o una coincidencia. Míralos cuando entre un caso nuevo del mismo tipo.
          </p>
          {visiblesEmergentes.length === 0 ? (
            <p className="small">Todos los emergentes están marcados como vistos.</p>
          ) : (
            <ul className="small">
              {visiblesEmergentes.map((grupo) => (
                <li key={grupo.ejemplo} style={{ marginBottom: 6 }}>
                  «{cortar(grupo.ejemplo, 110)}»{" "}
                  <span className="badge ok">{grupo.homogenea}% igual</span>{" "}
                  <span className="badge">{grupo.total} casos</span>{" "}
                  {grupo.casos.map((caso) => (
                    <Link
                      key={caso.caseId}
                      href={`/cases/${caso.caseId}`}
                      style={{ marginRight: 6 }}
                    >
                      {caso.caseId.replace("case_", "")}
                    </Link>
                  ))}
                  <MarcarVistoButton ejemplo={grupo.ejemplo} />
                </li>
              ))}
            </ul>
          )}
          {ocultos > 0 && (
            <p className="small muted">
              {ocultos} ocultos por estar vistos.{" "}
              <RestaurarPatronesButton />
            </p>
          )}
        </div>
      )}

      {duplicados.length > 0 && (
        <div className="section">
          <h2>Posibles duplicados</h2>
          <p className="small muted">
            El mismo ROJ o ECLI en más de un caso: casi con seguridad es el mismo PDF subido dos
            veces. Elige cuál te quedas y archiva el resto (archivar solo lo oculta; no borra
            nada).
          </p>
          <ul className="small">
            {duplicados.map((dup) => (
              <li key={`${dup.campo}-${dup.valor}`} style={{ marginBottom: 8 }}>
                <strong>
                  {dup.campo} {dup.valor}
                </strong>{" "}
                →{" "}
                {dup.casos.map((caseId) => (
                  <Link key={caseId} href={`/cases/${caseId}`} style={{ marginRight: 6 }}>
                    {caseId.replace("case_", "")}
                  </Link>
                ))}
                <div>
                  <ResolvedorDuplicado casos={dup.casos} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {frios.length > 0 && (
        <div className="section">
          <h2>Casos fríos (más de 30 días sin tocar)</h2>
          <p className="small muted">
            Sin revisar y sin actividad desde hace más de un mes. No suma al total (se solapa con
            «pendientes de revisión»); van ordenados por antigüedad.
          </p>
          <ul className="small">
            {frios.slice(0, 10).map((item) => (
              <li key={item.id} style={{ marginBottom: 4 }}>
                <Link href={`/cases/${item.id}`}>
                  {cortar(item.headline, 80)}
                </Link>{" "}
                <span className="badge warn">{diasSinTocar(item)} d</span>
              </li>
            ))}
            {frios.length > 10 && <li className="muted">… y {frios.length - 10} más</li>}
          </ul>
          <p className="small">
            <Link href="/cases?sort=dias&dir=desc">Ver todos ordenados por «sin tocar» →</Link>
          </p>
        </div>
      )}

      {(stale.length > 0 || escaneados.length > 0) && (
        <div className="section">
          <h2>PDFs con problemas</h2>
          <p className="small muted">
            <strong>Qué son</strong>: el PDF cambió desde el último análisis, o es un escaneo sin
            texto extraíble. <strong>Cómo se arregla</strong>: abre el caso y pulsa «Reanalizar»
            en su ficha —lo lanza la aplicación y consume IA, así que lo decide el abogado—. Si es
            un escaneo, antes hace falta un PDF con texto seleccionable.
          </p>
          <ul className="small">
            {stale.map((id) => (
              <li key={`s-${id}`}>
                <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link> — el PDF es más nuevo
                que el análisis
              </li>
            ))}
            {escaneados.map((id) => (
              <li key={`e-${id}`}>
                <Link href={`/cases/${id}`}>{id.replace("case_", "")}</Link> — sin texto extraíble
                (posible escaneo)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="section">
        <h2>Trabajos con error</h2>
        <p className="small muted">
          Solo se ven los de esta sesión de la aplicación (se borran al reiniciar).
        </p>
        {fallos.length === 0 ? (
          <p className="small">Sin fallos.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Trabajo</th>
                <th>Cuándo</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {fallos.map((job) => (
                <tr key={job.id}>
                  <td className="small">
                    {job.kind}
                    {job.caseId ? ` · ${job.caseId}` : ""}
                  </td>
                  <td className="small">{fecha(job.startedAt)}</td>
                  <td className="small" style={{ color: "var(--red)" }}>
                    {(job.error ?? "").slice(0, 300)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {historial.length > 0 && (
        <div className="section">
          <h2>Histórico de alertas</h2>
          <p className="small muted">
            Un registro por día desde que empezaste a consultar esta página (se conservan 180 días):
            sirve para ver si la pila crece o baja. Si hoy no entras, no se registra.
          </p>
          <table>
            <thead>
              <tr>
                <th>Día</th>
                <th>Total</th>
                <th>Leyes cambiadas</th>
                <th>Criterio dividido</th>
                <th>Calidad</th>
                <th>Emergentes</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((dia) => (
                <tr key={dia.fecha}>
                  <td className="mono small">{dia.fecha.slice(5)}</td>
                  <td>
                    <span className={`badge ${dia.total > 40 ? "ko" : dia.total > 20 ? "warn" : "ok"}`}>
                      {dia.total}
                    </span>
                  </td>
                  <td className="small">{dia.vigencia}</td>
                  <td className="small">{dia.dividido}</td>
                  <td className="small">{dia.calidad}</td>
                  <td className="small">{dia.emergentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
