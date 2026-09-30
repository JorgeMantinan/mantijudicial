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
          Análisis de jurisprudencia, legislación del BOE y patrones de resultado. Denegación por
          defecto: sin sesión no hay acceso.
        </p>

        <Suspense fallback={<p className="muted small">Cargando…</p>}>
          <LoginForm />
        </Suspense>

        <p className="auth-hint">
          Primera vez: <code>pnpm seed</code> crea el administrador.
          <br />
          ¿Olvidaste la contraseña?{" "}
          <code>pnpm seed -- --reset-password=NUEVA_CONTRASEÑA</code>
          <br />
          Altas de usuarios: menú <strong>Usuarios</strong> (solo administración).
        </p>
      </div>
    </div>
  );
}
