import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { ARG_OUTCOME, OUTCOME, REVIEW, label } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AyudaPage() {
  await requireActor();

  return (
    <>
      <h1>Ayuda</h1>
      <p className="lead">
        Cómo funciona la plataforma, qué significan los estados y qué puedes exportar. Todo lo que
        ves aquí sale de tu corpus: <span className="mono">cases/</span> (sentencias) y{" "}
        <span className="mono">laws/</span> (texto consolidado del BOE). El listado de lo nuevo
        está en <Link href="/novedades">/novedades</Link>.
      </p>

      <div className="section">
        <h2>Atajos de teclado</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Tecla</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">/</td>
              <td>Búsqueda</td>
            </tr>
            <tr>
              <td className="mono">a</td>
              <td>Alertas</td>
            </tr>
            <tr>
              <td className="mono">i</td>
              <td>Informes del periodo</td>
            </tr>
            <tr>
              <td className="mono">r</td>
              <td>Revisión humana</td>
            </tr>
            <tr>
              <td className="mono">N</td>
              <td>En una ficha: abrir el siguiente caso pendiente de revisar</td>
            </tr>
            <tr>
              <td className="mono">?</td>
              <td>Abrir o cerrar esta ayuda flotante</td>
            </tr>
          </tbody>
        </table>
        <p className="small muted">Ningún atajo actúa mientras estás escribiendo en un campo.</p>
      </div>

      <div className="section">
        <h2>Subir un caso nuevo</h2>
        <ol className="small">
          <li>
            Ve a <Link href="/cases">Casos</Link> y usa «Subir un caso nuevo» (puedes elegir varios
            PDF a la vez; se procesan uno a uno).
          </li>
          <li>
            El sistema extrae texto, recorta metadatos, analiza con IA y cruza las citas con el BOE.
            Tarda unos minutos: la página se actualiza sola.
          </li>
          <li>
            Abre la ficha y revisa el resultado en <Link href="/review">Revisión</Link>. Marca
            «Revisado por»: eso es lo que da validez interna antes de enseñárselo a un cliente.
          </li>
          <li>
            Si el PDF cambia después, la ficha avisa («el PDF cambió desde el análisis») y puedes
            relanzar el análisis desde «reanalizar».
          </li>
        </ol>
      </div>

      <div className="section">
        <h2>Qué significan los estados</h2>
        <h3>Revisión humana</h3>
        <ul className="small">
          {Object.entries(REVIEW).map(([key, texto]) => (
            <li key={key}>
              <span className={`badge ${key === "UNREVIEWED" ? "warn" : key === "REJECTED" ? "ko" : "ok"}`}>
                {texto}
              </span>{" "}
              <span className="muted mono">{key}</span>
            </li>
          ))}
        </ul>
        <h3>Resultado de la casación</h3>
        <ul className="small">
          {Object.entries(OUTCOME).map(([key, texto]) => (
            <li key={key}>
              {texto} <span className="muted mono">({key})</span>
            </li>
          ))}
        </ul>
        <h3>Aplicabilidad de una comparación</h3>
        <ul className="small">
          <li>
            <span className="badge ok">ALTA</span> el otro caso apoya directamente tu línea
          </li>
          <li>
            <span className="badge warn">MEDIA</span> apoya parcialmente
          </li>
          <li>
            <span className="badge">BAJA</span> sirve como contraste
          </li>
        </ul>
        <h3>Argumentos</h3>
        <ul className="small">
          {Object.entries(ARG_OUTCOME).map(([key, texto]) => (
            <li key={key}>
              {texto} <span className="muted mono">({key})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="section">
        <h2>Exportar e imprimir</h2>
        <ul className="small">
          <li>
            <Link href="/informes">Informes</Link>: imprimir con el botón (PDF del navegador) o
            «descargar CSV» para Excel.
          </li>
          <li>
            <Link href="/cases">Casos</Link>: «descargar CSV» con los filtros que tengas puestos.
          </li>
          <li>
            En cada ficha: «exportar JSON» (datos completos), «imprimir ficha», «dossier para el
            cliente» y el «informe imprimible» de cada comparación.
          </li>
          <li>
            <strong>Archivar</strong>: en la ficha, «Archivar» oculta el caso de la lista de{" "}
            <Link href="/cases">Casos</Link> sin borrar nada (con la casilla «mostrar archivados»
            vuelve a aparecer).
          </li>
        </ul>
      </div>

      <div className="section">
        <h2>Permisos y seguridad</h2>
        <ul className="small">
          <li>Sin sesión no hay acceso: todas las rutas lo exigen (permiso denegado por defecto).</li>
          <li>
            Cada caso pertenece a un despacho; se puede compartir concrentemente con otro usuario o
            despacho desde la ficha («Compartir»), con acciones puntuales y caducidad.
          </li>
          <li>Las notas privadas son solo para el abogado y nunca salen en exportaciones.</li>
          <li>El administrador puede activar doble factor (TOTP) en <Link href="/users">Usuarios</Link>.</li>
          <li>
            Toda alta, permiso o login queda en la auditoría (visible para el administrador en{" "}
            <Link href="/users">Usuarios → Actividad reciente</Link>).
          </li>
        </ul>
      </div>

      <div className="notice">
        Los textos del BOE tienen carácter <strong>meramente informativo</strong>: para decisiones
        jurídicas consulta la publicación oficial. Los análisis asistidos por IA están señalados como
        tales y requieren <strong>revisión profesional</strong>; no constituyen asesoramiento.
      </div>
    </>
  );
}
