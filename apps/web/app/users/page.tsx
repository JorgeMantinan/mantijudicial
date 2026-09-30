import Link from "next/link";
import { redirect } from "next/navigation";
import { loadIdentity, requireActor } from "@/lib/auth";
import { UserForm } from "./user-form";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  ORG_ADMIN: "Administración",
  LAWYER: "Abogado/a",
  PARALEGAL: "Auxiliar",
  VIEWER: "Solo lectura",
};

export default async function UsersPage() {
  const actor = await requireActor();
  if (actor.role !== "ORG_ADMIN") redirect("/");

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

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Despacho</th>
            <th>Alta</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                {user.name} {user.self && <span className="badge ok">tú</span>}
              </td>
              <td className="small">{user.email}</td>
              <td className="small">{ROLE_LABEL[user.role] ?? user.role}</td>
              <td className="small">{user.firm}</td>
              <td className="small">{user.created}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="small muted">
        Roles: <strong>Administración</strong> (gestiona casos, usuarios y permisos) ·{" "}
        <strong>Abogado/a</strong> (crea y analiza casos) · <strong>Auxiliar</strong> (lee y analiza,
        no descarga) · <strong>Solo lectura</strong>. Si necesitas otro despacho aislado, créalo con{" "}
        <Link href="/login">pnpm seed</Link>.
      </p>
    </>
  );
}
