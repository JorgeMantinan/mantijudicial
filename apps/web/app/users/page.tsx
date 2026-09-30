import Link from "next/link";
import { redirect } from "next/navigation";
import { loadIdentity, requireActor } from "@/lib/auth";
import { getAuditoria } from "@/lib/dataset";
import { AUDIT, ROLE, label } from "@/lib/labels";
import { SortTh } from "@/lib/sort-th";
import { UserForm } from "./user-form";
import { MfaPanel } from "./mfa-panel";

export const dynamic = "force-dynamic";

const SORTS = ["nombre", "correo", "rol", "alta"] as const;
type SortKey = (typeof SORTS)[number];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; accion?: string; persona?: string }>;
}) {
  const actor = await requireActor();
  if (actor.role !== "ORG_ADMIN") redirect("/");

  const params = await searchParams;
  const identity = await loadIdentity();
  const firms = new Map(identity.listFirms().map((firm) => [firm.id, firm.name]));
  const users = identity.listUsers().map((user) => {
    const membership = identity.listMemberships(user.id)[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership?.role ?? "—",
      firm: membership ? (firms.get(membership.firmId) ?? membership.firmId) : "—",
      created: user.created_at.slice(0, 10),
      self: user.id === actor.userId,
    };
  });

  const auditoriaBruta = await getAuditoria(300);
  const accionSel = params.accion ?? "";
  const personaSel = params.persona ?? "";
  const auditoria = auditoriaBruta
    .filter((entrada) => !accionSel || entrada.action === accionSel)
    .filter((entrada) => !personaSel || entrada.actor === personaSel)
    .slice(0, 40);
  const accionesDisponibles = [...new Set(auditoriaBruta.map((entrada) => entrada.action))].sort();
  const personasDisponibles = [...new Set(auditoriaBruta.map((entrada) => entrada.actor))];
  const nombres = new Map(users.map((user) => [user.id, user.name]));

  const sort = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "nombre";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const sorted = [...users].sort((a, b) => {
    let cmp = 0;
    if (sort === "nombre") cmp = a.name.localeCompare(b.name, "es");
    else if (sort === "correo") cmp = a.email.localeCompare(b.email, "es");
    else if (sort === "rol") cmp = label(ROLE, a.role).localeCompare(label(ROLE, b.role), "es");
    else cmp = a.created.localeCompare(b.created);
    return dir === "asc" ? cmp : -cmp;
  });

  return (
    <>
      <h1>Usuarios</h1>
      <p className="lead">
        Altas del despacho. Las contraseñas se guardan con scrypt (nunca en claro) y toda alta queda
        en <span className="mono">data/audit.log</span>.
      </p>

      <div className="section">
        <h2>Crear usuario</h2>
        <UserForm />
      </div>

      {!identity.mfaEnabled(actor.userId) && (
        <div className="notice" style={{ borderColor: "var(--red)" }}>
          <strong>Doble factor no activado en tu cuenta.</strong> Actíalo abajo (MFA): protege el
          acceso a todos los casos del despacho.
        </div>
      )}

      <div className="section">
        <h2>Doble factor (MFA)</h2>
        <ol className="small">
          <li>
            Instala una app de códigos: <strong>Google Authenticator</strong>, <strong>Authy</strong>{" "}
            o <strong>1Password</strong> (cualquier una que siga el estándar TOTP).
          </li>
          <li>
            En el panel de abajo, pulsa el botón de activar, <strong>escanea el QR</strong> (o copia
            la clave) y escribe el código de 6 dígitos que muestra la app.
          </li>
          <li>
            <strong>Guarda los códigos de respaldo</strong>: si pierdes el móvil, sin ellos solo un
            administrador puede desactivarlo.
          </li>
        </ol>
      </div>

      <MfaPanel />

      <table>
        <thead>
          <tr>
            <SortTh path="/users" sortKey="nombre" current={sort} dir={dir} label="Nombre" />
            <SortTh path="/users" sortKey="correo" current={sort} dir={dir} label="Correo" />
            <SortTh path="/users" sortKey="rol" current={sort} dir={dir} label="Rol" />
            <th>Despacho</th>
            <SortTh path="/users" sortKey="alta" current={sort} dir={dir} label="Alta" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((user) => (
            <tr key={user.id}>
              <td>
                {user.name} {user.self && <span className="badge ok">tú</span>}
              </td>
              <td className="small">{user.email}</td>
              <td className="small" title={user.role}>
                {label(ROLE, user.role)}
              </td>
              <td className="small">{user.firm}</td>
              <td className="small">{user.created}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section">
        <h2>Actividad reciente</h2>
        <p className="small muted">
          Últimas entradas de <span className="mono">data/audit.log</span> (sin notas privadas).
        </p>
        <form className="filters" action="/users" method="get">
          <label className="small muted" style={{ display: "grid", gap: 4 }}>
            Acción
            <select name="accion" defaultValue={accionSel}>
              <option value="">Todas</option>
              {accionesDisponibles.map((accion) => (
                <option key={accion} value={accion}>
                  {label(AUDIT, accion)}
                </option>
              ))}
            </select>
          </label>
          <label className="small muted" style={{ display: "grid", gap: 4 }}>
            Persona
            <select name="persona" defaultValue={personaSel}>
              <option value="">Todas</option>
              {personasDisponibles.map((persona) => (
                <option key={persona} value={persona}>
                  {nombres.get(persona) ?? persona}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" style={{ marginTop: 18 }}>
            Filtrar
          </button>
          {(accionSel || personaSel) && (
            <Link className="small" href="/users" style={{ marginTop: 22 }}>
              limpiar
            </Link>
          )}
        </form>
        {auditoria.length === 0 ? (
          <p className="small">Sin actividad con ese filtro.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Cuándo</th>
                <th>Quién</th>
                <th>Qué</th>
                <th>Recurso</th>
              </tr>
            </thead>
            <tbody>
              {auditoria.map((entrada, index) => (
                <tr key={`${entrada.at}-${index}`}>
                  <td className="small mono">
                    {entrada.at ? new Date(entrada.at).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="small">{nombres.get(entrada.actor) ?? entrada.actor}</td>
                  <td className="small">{label(AUDIT, entrada.action)}</td>
                  <td className="small mono">{entrada.resource ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small muted">
        Roles: <strong>Administración</strong> (gestiona casos, usuarios y permisos) ·{" "}
        <strong>Abogado/a</strong> (crea y analiza casos) · <strong>Auxiliar</strong> (lee y analiza,
        no descarga) · <strong>Solo lectura</strong>. Si necesitas otro despacho aislado, créalo con{" "}
        <Link href="/login">pnpm seed</Link>.
      </p>
    </>
  );
}
