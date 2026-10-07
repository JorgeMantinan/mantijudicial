import Link from "next/link";
import { Bar } from "@/components/bar";
import { PrintButton } from "@/components/print-button";
import { CopyButton } from "@/components/copy-button";
import { canViewCase, contextoVisibilidad } from "@/lib/auth";
import { filtrarFrasesDelTema, getGruposFrases, getInforme, getVigenciaAlerts, listCases } from "@/lib/dataset";
import { BRANCH, OUTCOME, label } from "@/lib/labels";
import { SortTh } from "@/lib/sort-th";
import { cortar } from "@/lib/texto";
import { OutcomeBadge } from "@/lib/ui";

export const dynamic = "force-dynamic";

function fechaLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function validar(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    desde2?: string;
    hasta2?: string;
    sort?: string;
    dir?: string;
    branch?: string;
    outcome?: string;
  }>;
}) {
  const { actor, orgId, grants } = await contextoVisibilidad();
  const sp = await searchParams;
  const hoy = fechaLocal(new Date());
  const mesInicio = fechaLocal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const desde = validar(sp.desde, mesInicio);
  const hasta = validar(sp.hasta, hoy);

  const informe = await getInforme(desde, hasta, (caseId) =>
    canViewCase(actor, caseId, orgId, grants),
  { branch: sp.branch, outcome: sp.outcome },
  );

  // Periodo B por defecto: el inmediatamente anterior de la misma duración.
  const dias = Math.max(
    1,
    Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000) || 30,
  );
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const inicio = Date.parse(desde);
  const desde2 = validar(sp.desde2, fmt(inicio - (dias + 1) * 86_400_000));
  const hasta2 = validar(sp.hasta2, fmt(inicio - 86_400_000));
  const informeB = await getInforme(desde2, hasta2, (caseId) =>
    canViewCase(actor, caseId, orgId, grants),
  { branch: sp.branch, outcome: sp.outcome },
  );
  const alertasPeriodo = (await getVigenciaAlerts())
    .map((alerta) => ({
      ...alerta,
      casos: alerta.casos.filter((caso) => {
        const fecha = caso.fecha_sentencia ?? "";
        return fecha >= desde && fecha <= hasta && canViewCase(actor, caso.caseId, orgId, grants);
      }),
    }))
    .filter((alerta) => alerta.casos.length > 0)
    .slice(0, 8);

  const gruposGlobal = await getGruposFrases();
  const frasesPeriodo = filtrarFrasesDelTema(
    gruposGlobal,
    new Set(informe.casos.map((caso) => caso.id)),
  );
  const frasesB = filtrarFrasesDelTema(
    gruposGlobal,
    new Set(informeB.casos.map((caso) => caso.id)),
  );
  const ejemplosA = new Set(frasesPeriodo.map((grupo) => grupo.ejemplo));
  const ejemplosB = new Set(frasesB.map((grupo) => grupo.ejemplo));
  const comunesFrases = [...ejemplosA].filter((ejemplo) => ejemplosB.has(ejemplo)).length;
  const fechaPorId = new Map(informe.casos.map((caso) => [caso.id, caso.fecha]));
  const porMes = !informe.periodos[0]?.includes("-T");
  const etiquetaFecha = (fecha: string): string =>
    porMes
      ? fecha.slice(0, 7)
      : `${fecha.slice(0, 4)}-T${Math.ceil(Number(fecha.slice(5, 7)) / 3)}`;
  const matrizFrases = frasesPeriodo.slice(0, 6).map((grupo) => {
    const celdas: Record<string, { n: number; e: number; d: number }> = {};
    for (const caso of grupo.casos) {
      const fecha = fechaPorId.get(caso.caseId);
      if (!fecha) continue;
      const clave = etiquetaFecha(fecha);
      const celda = celdas[clave] ?? { n: 0, e: 0, d: 0 };
      celda.n += 1;
      if (caso.outcome === "ESTIMED") celda.e += 1;
      else if (caso.outcome === "DISMISSED") celda.d += 1;
      celdas[clave] = celda;
    }
    return { frase: grupo.ejemplo, total: grupo.total, homogenea: grupo.homogenea, celdas };
  });

  const entradasMap = new Map((await listCases()).map((item) => [item.id, item.generatedAt]));
  const incorporadas = informe.casos.filter((caso) => {
    const fecha = (entradasMap.get(caso.id) ?? "").slice(0, 10);
    return fecha.length === 10 && fecha >= desde && fecha <= hasta;
  });

  const unionOutcomes = [
    ...new Set([...Object.keys(informe.porResultado), ...Object.keys(informeB.porResultado)]),
  ];
  const comparacion: Array<{ nombre: string; a: number; b: number }> = [
    { nombre: "Sentencias", a: informe.casos.length, b: informeB.casos.length },
    { nombre: "Pendientes de revisar", a: informe.pendientes, b: informeB.pendientes },
    { nombre: "Temas activos", a: informe.temas.length, b: informeB.temas.length },
    ...unionOutcomes.map((key) => ({
      nombre: `Resultado: ${label(OUTCOME, key)}`,
      a: informe.porResultado[key] ?? 0,
      b: informeB.porResultado[key] ?? 0,
    })),
    { nombre: "Frases homogéneas", a: frasesPeriodo.length, b: frasesB.length },
    { nombre: "Frases comunes (mismo texto)", a: comunesFrases, b: comunesFrases },
    {
      nombre: "Frases solo de este periodo",
      a: ejemplosA.size - comunesFrases,
      b: ejemplosB.size - comunesFrases,
    },
  ];

  const sort = ["fecha", "caso", "resultado", "m-temas", "m-matriz", "m-normas", "m-incorp"].includes(
    sp.sort ?? "",
  )
    ? (sp.sort as string)
    : "fecha";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const factor = dir === "desc" ? -1 : 1;
  const baseInf = {
    desde,
    hasta,
    desde2,
    hasta2,
    branch: sp.branch,
    outcome: sp.outcome,
  };
  const casosOrdenados = [...informe.casos].sort((a, b) => {
    let cmp = 0;
    if (sort === "caso") cmp = a.id.localeCompare(b.id);
    else if (sort === "resultado") cmp = a.outcome.localeCompare(b.outcome);
    else cmp = a.fecha.localeCompare(b.fecha);
    return dir === "asc" ? cmp : -cmp;
  });
  const conOrden = (campo: string): string => {
    const params = new URLSearchParams();
    params.set("desde", desde);
    params.set("hasta", hasta);
    params.set("desde2", desde2);
    params.set("hasta2", hasta2);
    if (sp.branch) params.set("branch", sp.branch);
    if (sp.outcome) params.set("outcome", sp.outcome);
    params.set("sort", campo);
    params.set("dir", dir === "asc" && sort === campo ? "desc" : "asc");
    return `/informes?${params.toString()}`;
  };

  const chips = [
    sp.branch ? { texto: `Rama: ${label(BRANCH, sp.branch)}`, clave: "branch" } : null,
    sp.outcome ? { texto: `Resultado: ${label(OUTCOME, sp.outcome)}`, clave: "outcome" } : null,
  ].filter((chip): chip is { texto: string; clave: string } => chip !== null);
  const sinParam = (clave: string): string => {
    const p = new URLSearchParams();
    const actuales: Record<string, string | undefined> = {
      desde,
      hasta,
      desde2,
      hasta2,
      branch: sp.branch,
      outcome: sp.outcome,
      sort: sp.sort,
      dir: sp.dir,
    };
    for (const [k, v] of Object.entries(actuales)) if (v && k !== clave) p.set(k, v);
    const qs = p.toString();
    return `/informes${qs ? `?${qs}` : ""}`;
  };

  const temasOrden = [...informe.temas].sort((a, b) =>
    sort === "m-temas" ? (a.casos - b.casos) * factor : b.casos - a.casos,
  );
  const matrizOrden = [...informe.matriz].sort((a, b) =>
    sort === "m-matriz" ? (a.total - b.total) * factor : b.total - a.total,
  );
  const incorporadasOrden = [...incorporadas].sort((a, b) => {
    if (sort === "m-incorp") {
      return (
        (entradasMap.get(a.id) ?? "").localeCompare(entradasMap.get(b.id) ?? "") *
        (dir === "desc" ? -1 : 1)
      );
    }
    return (entradasMap.get(b.id) ?? "").localeCompare(entradasMap.get(a.id) ?? "");
  });

  const normasOrden = [...informe.leyes].sort((a, b) =>
    sort === "m-normas" ? (a.veces - b.veces) * factor : b.veces - a.veces,
  );

  const resumenPeriodo = [
    `Informe MantiJudicial ${desde} → ${hasta}`,
    `Sentencias: ${informe.casos.length} · pendientes de revisar: ${informe.pendientes}`,
    ...Object.entries(informe.porResultado)
      .sort((a, b) => b[1] - a[1])
      .map(([outcome, cantidad]) => `${label(OUTCOME, outcome)}: ${cantidad}`),
    alertasPeriodo.length > 0
      ? `Alertas de vigencia que tocan al periodo: ${alertasPeriodo.length}`
      : null,
    Object.keys(informe.porRama).length > 0
      ? `Ramas: ${Object.entries(informe.porRama)
          .sort((a, b) => b[1] - a[1])
          .map(([rama, cantidad]) => `${label(BRANCH, rama)} ${cantidad}`)
          .join(" · ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <article className="print-sheet">
      <p className="small muted no-print">
        {(sp.desde2 || sp.hasta2) && (
          <span className="badge warn" style={{ marginRight: 8 }}>
            Comparación activa con periodo B personalizado
          </span>
        )}
        <Link href="/alertas">← Alertas</Link> · <Link href="/evolucion">Evolución</Link> ·{" "}
        <a
          href={`/api/export/informe?desde=${desde}&hasta=${hasta}${
            sp.branch ? `&branch=${encodeURIComponent(sp.branch)}` : ""
          }${sp.outcome ? `&outcome=${encodeURIComponent(sp.outcome)}` : ""}`}
        >
          descargar CSV
        </a>{" "}
        · <CopyButton texto={resumenPeriodo} etiqueta="Copiar resumen" />
      </p>
      <PrintButton text="Imprimir el informe" />

      <h1 style={{ marginTop: 0 }}>Informe del periodo</h1>
      <p className="small">
        Sentencias resueltas entre <strong>{desde}</strong> y <strong>{hasta}</strong> · generado el{" "}
        {new Date().toLocaleString("es-ES")}
      </p>

      <form className="filters no-print" action="/informes" method="get">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Desde
          <input type="date" name="desde" defaultValue={desde} />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Comparar desde
          <input type="date" name="desde2" defaultValue={desde2} />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Comparar hasta
          <input type="date" name="hasta2" defaultValue={hasta2} />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Rama
          <select name="branch" defaultValue={sp.branch ?? ""}>
            <option value="">Todas</option>
            {Object.entries(BRANCH).map(([value, texto]) => (
              <option key={value} value={value}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Resultado
          <select name="outcome" defaultValue={sp.outcome ?? ""}>
            <option value="">Todos</option>
            {Object.entries(OUTCOME).map(([value, texto]) => (
              <option key={value} value={value}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={{ marginTop: 18 }}>
          Actualizar
        </button>
      </form>

      <p className="small no-print" style={{ display: "flex", gap: 14, marginTop: -6 }}>
        <span className="muted">Atajos:</span>
        <Link href={`/informes?${new URLSearchParams({ desde: mesInicio, hasta: hoy })}`}>
          Este mes
        </Link>
        <Link
          href={`/informes?${new URLSearchParams({
            desde: fechaLocal(new Date(Date.now() - 90 * 86_400_000)),
            hasta: hoy,
          })}`}
        >
          Últimos 90 días
        </Link>
        <Link
          href={`/informes?${new URLSearchParams({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy })}`}
        >
          Este año
        </Link>
      </p>

      {chips.length > 0 && (
        <p className="small" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -4 }}>
          {chips.map((chip) => (
            <span
              key={chip.clave}
              className="badge"
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              {chip.texto}
              <a
                href={sinParam(chip.clave)}
                aria-label={`Quitar filtro: ${chip.texto}`}
                title="Quitar este filtro"
                style={{ color: "var(--muted)" }}
              >
                ✕
              </a>
            </span>
          ))}
        </p>
      )}

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="value">{informe.casos.length}</div>
          <div className="label">sentencias en el periodo</div>
        </div>
        <div className="card">
          <div className="value">{informe.pendientes}</div>
          <div className="label">pendientes de revisar</div>
        </div>
        <div className="card">
          <div className="value">{informe.temas.length}</div>
          <div className="label">temas activos</div>
        </div>
        <div className="card">
          <div className="value">{informe.leyes.length}</div>
          <div className="label">normas citadas (top)</div>
        </div>
      </div>

      <div className="section">
        <h2>Comparación de periodos</h2>
        <p className="small muted">
          A = {desde} → {hasta} · B = {desde2} → {hasta2} (periodo anterior de la misma duración).
        </p>
        <table>
          <thead>
            <tr>
              <th>Métrica</th>
              <th style={{ textAlign: "right" }}>A</th>
              <th style={{ textAlign: "right" }}>B</th>
              <th style={{ textAlign: "right" }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {comparacion.map((fila) => {
              const delta = fila.a - fila.b;
              return (
                <tr key={fila.nombre}>
                  <td className="small">{fila.nombre}</td>
                  <td style={{ textAlign: "right" }}>{fila.a}</td>
                  <td style={{ textAlign: "right" }}>{fila.b}</td>
                  <td
                    className="small"
                    style={{ textAlign: "right", color: delta > 0 ? "var(--green)" : delta < 0 ? "var(--red)" : undefined }}
                  >
                    {delta > 0 ? `+${delta}` : String(delta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h2>Resultado y rama</h2>
        <table>
          <thead>
            <tr>
              <th>Resultado</th>
              <th>Casos</th>
              <th style={{ width: 160 }}>Proporción</th>
              <th>Rama</th>
              <th>Casos</th>
              <th style={{ width: 160 }}>Proporción</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const res = Object.entries(informe.porResultado).sort((a, b) => b[1] - a[1]);
              const ram = Object.entries(informe.porRama).sort((a, b) => b[1] - a[1]);
              const filas = Math.max(res.length, ram.length);
              const maxRes = res[0]?.[1] ?? 1;
              const maxRam = ram[0]?.[1] ?? 1;
              return Array.from({ length: filas }, (_, index) => {
                const r = res[index];
                const m = ram[index];
                return (
                  <tr key={index}>
                    <td className="small">{r ? label(OUTCOME, r[0]) : ""}</td>
                    <td>{r ? r[1] : ""}</td>
                    <td>{r ? <Bar value={r[1]} max={maxRes} tone={r[0] === "ESTIMED" ? "ok" : r[0] === "DISMISSED" ? "ko" : "accent"} /> : ""}</td>
                    <td className="small">{m ? label(BRANCH, m[0]) : ""}</td>
                    <td>{m ? m[1] : ""}</td>
                    <td>{m ? <Bar value={m[1]} max={maxRam} tone="accent" /> : ""}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {alertasPeriodo.length > 0 && (
        <div className="section">
          <h2>Atención que pide este periodo</h2>
          <p className="small muted">
            Leyes citadas por las sentencias de <strong>este rango</strong> cuya versión vigente es
            posterior a la sentencia: conviene mirarlas antes de citar ese artículo.
          </p>
          <table>
            <thead>
              <tr>
                <th>Norma y artículo</th>
                <th>De qué trata</th>
                <th>Casos del periodo</th>
              </tr>
            </thead>
            <tbody>
              {alertasPeriodo.map((alerta) => (
                <tr key={`${alerta.boe_id}-${alerta.block_id}`}>
                  <td className="small">
                    <strong>
                      {alerta.norma} {alerta.titulo}
                    </strong>
                    <div className="mono muted small">{alerta.boe_id}</div>
                  </td>
                  <td className="small">{alerta.resumen}…</td>
                  <td className="small">
                    {alerta.casos.length} caso{alerta.casos.length === 1 ? "" : "s"} (desde{" "}
                    {alerta.casos[0]?.fecha_sentencia})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2>Temas más trabajados</h2>
        {informe.temas.length === 0 ? (
          <p className="small muted">Sin temas con 2 casos o más en el periodo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                <SortTh path="/informes" sortKey="m-temas" current={sort} dir={dir} label="Casos" base={baseInf} />
                <th>Distribución</th>
              </tr>
            </thead>
            <tbody>
              {temasOrden.map((tema) => (
                <tr key={tema.topic}>
                  <td className="small">
                    <Link href={`/temas/${encodeURIComponent(tema.topic)}`}>{tema.topic}</Link>
                  </td>
                  <td>{tema.casos}</td>
                  <td className="small">
                    {Object.entries(tema.distribution)
                      .map(([key, value]) => `${label(OUTCOME, key)} ${value}`)
                      .join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Temas por {informe.periodos[0]?.includes("-T") ? "trimestre" : "mes"}</h2>
        <p className="small muted">
          Cuántos casos de cada tema caen en cada periodo. Ayuda a ver la tendencia; es una
          asociación observada, no una predicción.
        </p>
        {informe.matriz.length === 0 ? (
          <p className="small muted">Sin temas en el periodo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tema</th>
                {informe.periodos.map((periodo) => (
                  <th key={periodo} style={{ textAlign: "right" }}>
                    {periodo}
                  </th>
                ))}
                <SortTh path="/informes" sortKey="m-matriz" current={sort} dir={dir} label="Total" base={baseInf} />
              </tr>
            </thead>
            <tbody>
              {matrizOrden.map((fila) => (
                <tr key={fila.topic}>
                  <td className="small">
                    <Link href={`/temas/${encodeURIComponent(fila.topic)}`}>{fila.topic}</Link>
                  </td>
                  {informe.periodos.map((periodo) => (
                    <td key={periodo} className="small" style={{ textAlign: "right" }}>
                      {fila.celdas[periodo] ?? <span className="muted">·</span>}
                    </td>
                  ))}
                  <td style={{ textAlign: "right" }}>
                    <strong>{fila.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {matrizFrases.length > 0 && informe.periodos.length > 0 && (
        <div className="section">
          <h2>Frases del periodo, mes a mes</h2>
          <p className="small no-print">
            <a href={`/api/export/frases?desde=${desde}&hasta=${hasta}`}>
              descargar CSV de esta matriz
            </a>
          </p>
          <p className="small muted">
            Frases homogéneas que aparecen en las sentencias del rango, repartidas por periodo con
            el formato <span className="mono">n (estimados/desestimados)</span>. Sirve para ver si
            la frase se mantiene o cambia de signo con el tiempo.
          </p>
          <table>
            <thead>
              <tr>
                <th>Frase</th>
                {informe.periodos.map((periodo) => (
                  <th key={periodo} style={{ textAlign: "right" }}>
                    {periodo}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {matrizFrases.map((fila) => (
                <tr key={fila.frase}>
                  <td className="small">«{cortar(fila.frase, 90)}»</td>
                  {informe.periodos.map((periodo) => {
                    const celda = fila.celdas[periodo];
                    return (
                      <td key={periodo} className="small" style={{ textAlign: "right" }}>
                        {celda ? (
                          <span title={`${celda.e} estimados / ${celda.d} desestimados`}>
                            {celda.n} ({celda.e}/{celda.d})
                          </span>
                        ) : (
                          <span className="muted">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="small" style={{ textAlign: "right" }}>
                    <strong>{fila.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h2>Normas más citadas</h2>
        {informe.leyes.length === 0 ? (
          <p className="small muted">Sin citas verificadas en el periodo.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Norma</th>
                <th>BOE</th>
                <SortTh path="/informes" sortKey="m-normas" current={sort} dir={dir} label="Citas" base={baseInf} />
              </tr>
            </thead>
            <tbody>
              {normasOrden.map((ley) => (
                <tr key={`${ley.norma}-${ley.boe_id ?? ""}`}>
                  <td className="small">{ley.norma}</td>
                  <td className="mono small">
                    {ley.boe_id ? <Link href={`/laws/${ley.boe_id}`}>{ley.boe_id}</Link> : "—"}
                  </td>
                  <td>{ley.veces}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {incorporadas.length > 0 && (
        <div className="section">
          <h2>Incorporadas al corpus en el periodo</h2>
          <p className="small muted">
            Casos cuyo <strong>análisis</strong> se hizo entre {desde} y {hasta} (puede que la
            sentencia sea anterior): es lo que ha entrado de nuevo al sistema en el rango.
          </p>
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>
                  <SortTh
                    path="/informes"
                    sortKey="m-incorp"
                    current={sort}
                    dir={dir}
                    label="Analizado el"
                    base={baseInf}
                  />
                </th>
                <th>Caso</th>
                <th style={{ width: 110 }}>Resuelta el</th>
              </tr>
            </thead>
            <tbody>
              {incorporadasOrden.slice(0, 15).map((caso) => (
                <tr key={caso.id}>
                  <td className="mono small">{(entradasMap.get(caso.id) ?? "").slice(0, 10)}</td>
                  <td className="small">
                    <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                  </td>
                  <td className="mono small">{caso.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {incorporadas.length > 15 && (
            <p className="small muted">… y {incorporadas.length - 15} más.</p>
          )}
        </div>
      )}

      <div className="section">
        <h2>Sentencias del periodo</h2>
        {informe.casos.length === 0 ? (
          <p className="small muted">No hay sentencias con fecha de resolución en ese rango.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>
                  <Link href={conOrden("fecha")}>Fecha</Link>
                </th>
                <th>
                  <Link href={conOrden("caso")}>Caso</Link>
                </th>
                <th style={{ width: 150 }}>
                  <Link href={conOrden("resultado")}>Resultado</Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {casosOrdenados.map((caso) => (
                <tr key={caso.id}>
                  <td className="mono small">{caso.fecha}</td>
                  <td className="small">
                    <Link href={`/cases/${caso.id}`}>{caso.headline}</Link>
                  </td>
                  <td>
                    <OutcomeBadge outcome={caso.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small muted">
        Informe generado por MantiJudicial a partir de tu corpus. Los análisis asistidos por IA
        pendientes de revisión se señalan en la ficha de cada caso.
      </p>
    </article>
  );
}
