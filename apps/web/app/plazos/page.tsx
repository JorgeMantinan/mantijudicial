import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { getLaw } from "@/lib/dataset";
import { TRAMITES, calcularFechaLimite, fechaEs, verificarTramite } from "@pipeline/plazos";

export const dynamic = "force-dynamic";

const LEC_ID = "BOE-A-2000-323";

export default async function PlazosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; tramite?: string; dias?: string; agosto?: string; festivos?: string }>;
}) {
  await requireActor();
  const sp = await searchParams;

  const tramite = TRAMITES.find((item) => item.id === sp.tramite) ?? TRAMITES[0]!;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha ?? "") ? sp.fecha! : new Date().toISOString().slice(0, 10);
  const diasOverride = sp.dias && /^\d{1,3}$/.test(sp.dias) ? Number(sp.dias) : null;
  const dias = diasOverride ?? tramite.dias;
  const festivosExtra = (sp.festivos ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));

  const resultado = calcularFechaLimite({
    fechaNotificacion: fecha,
    dias,
    excluyeInhabiles: true,
    incluyeAgosto: sp.agosto === "1",
    festivosExtra,
  });

  const lec = await getLaw(LEC_ID);
  const block = lec?.blocks.find((item) => item.id === tramite.bloque);
  const verificacion = block ? verificarTramite(block.texto, tramite) : null;

  return (
    <>
      <h1>Plazos procesales</h1>
      <p className="lead">
        Cómputo según los <strong>arts. 133.1 y 133.2 LEC</strong>: el plazo empieza el día
        siguiente a la notificación y se excluyen los inhábiles. Cada trámite indica el artículo
        exacto de la Ley de Enjuiciamiento Civil, comprobado contra el texto descargado del BOE.
      </p>

      <form className="filters" action="/plazos" method="get">
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Notificación
          <input type="date" name="fecha" defaultValue={fecha} required />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Trámite
          <select name="tramite" defaultValue={tramite.id}>
            {TRAMITES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} · {item.dias} días
              </option>
            ))}
          </select>
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Días (sobrescribir)
          <input
            type="number"
            name="dias"
            min={1}
            max={365}
            defaultValue={diasOverride ?? ""}
            placeholder={String(tramite.dias)}
            style={{ width: 110 }}
          />
        </label>
        <label className="small muted" style={{ display: "grid", gap: 4 }}>
          Festivos añadidos (AAAA-MM-DD,…)
          <input name="festivos" defaultValue={sp.festivos ?? ""} placeholder="2026-04-03, 2026-04-06" />
        </label>
        <label className="small" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 18 }}>
          <input type="checkbox" name="agosto" value="1" defaultChecked={sp.agosto === "1"} />
          Contar agosto como hábil
        </label>
        <button type="submit">Calcular</button>
      </form>

      <div className="grid">
        <div className="card">
          <div className="value">{fechaEs(resultado.fechaLimite)}</div>
          <div className="label">fecha límite</div>
        </div>
        <div className="card">
          <div className="value">{resultado.diasContados}</div>
          <div className="label">días computados</div>
        </div>
        <div className="card">
          <div className="value">{resultado.saltados.length}</div>
          <div className="label">días excluidos</div>
        </div>
        <div className="card">
          <div className="value">{tramite.articulo}</div>
          <div className="label">artículo LEC</div>
        </div>
      </div>

      <div className="section">
        <h2>
          {tramite.nombre}{" "}
          {verificacion ? (
            <span className={`badge ${verificacion.ok ? "ok" : "ko"}`}>
              {verificacion.ok ? "plazo verificado en la LEC" : "no coincide con el texto"}
            </span>
          ) : (
            <span className="badge warn">sin texto de la LEC cargado</span>
          )}
        </h2>
        <p className="small muted">
          Base legal:{" "}
          <Link href={`/laws/${LEC_ID}?block=${tramite.bloque}`}>
            art. {tramite.articulo} LEC (texto completo)
          </Link>
          {verificacion?.ok && " · la cita textual aparece en el artículo descargado"}
        </p>
        {verificacion && <blockquote>«{verificacion.cita}»</blockquote>}

        <h3>Avisos</h3>
        <ul className="small">
          {resultado.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>

        {resultado.saltados.length > 0 && (
          <>
            <h3>Días excluidos del cómputo</h3>
            <p className="small muted">
              {resultado.saltados
                .slice(0, 12)
                .map((item) => `${fechaEs(item.fecha)} (${item.motivo})`)
                .join(" · ")}
              {resultado.saltados.length > 12 ? ` · y ${resultado.saltados.length - 12} más` : ""}
            </p>
          </>
        )}
      </div>

      <div className="section">
        <h2>Tabla de plazos (LEC)</h2>
        <table>
          <thead>
            <tr>
              <th>Trámite</th>
              <th>Días</th>
              <th>Artículo</th>
              <th>En el texto de la LEC</th>
            </tr>
          </thead>
          <tbody>
            {TRAMITES.map((item) => {
              const article = lec?.blocks.find((b) => b.id === item.bloque);
              const check = article ? verificarTramite(article.texto, item) : null;
              return (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td>{item.dias}</td>
                  <td className="mono small">
                    <Link href={`/laws/${LEC_ID}?block=${item.bloque}`}>{item.articulo}</Link>
                  </td>
                  <td className="small">
                    {check?.ok ? (
                      <span className="badge ok">verificado</span>
                    ) : (
                      <span className="badge ko">revisar</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice">
        Esta herramienta es una ayuda de cómputo, no asesoramiento. Comprueba siempre los festivos
        de tu comunidad y localidad y las leyes especiales (laboral, contencioso-administrativo y
        mercantil tienen sus propios plazos).
      </div>
    </>
  );
}
