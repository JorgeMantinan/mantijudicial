import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect("/");

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          Manti<span>Judicial</span>
        </div>
        <h1>Entrar</h1>
        <p className="auth-sub">
          Tu despacho, con las sentencias del Supremo ya estructuradas y el texto del BOE cruzado
          con ellas.
        </p>
        <ul className="small" style={{ margin: "0 0 14px", paddingLeft: 18 }}>
          <li>Búsqueda por texto o por identificador (ECLI/ROJ) y fichas de tema</li>
          <li>Análisis con IA señalado como tal, con el coste a la vista</li>
          <li>Informes, dossiers y comparaciones listos para imprimir</li>
          <li>Cada caso solo lo ve quien tiene permiso (acceso por despacho)</li>
        </ul>

        <Suspense fallback={<p className="muted small">Cargando…</p>}>
          <LoginForm />
        </Suspense>

        <p className="auth-hint">
          Primera vez: <code>pnpm seed</code> crea el administrador. ¿Olvidaste la contraseña?{" "}
          <code>pnpm seed -- --reset-password=NUEVA_CONTRASEÑA</code>
          <br />
          Altas de usuarios: menú <strong>Usuarios</strong> (solo administración).
          <br />
          Ya dentro: <strong>/ayuda</strong> (atajos y guía) y <strong>/novedades</strong>.
        </p>
      </div>
    </div>
  );
}
