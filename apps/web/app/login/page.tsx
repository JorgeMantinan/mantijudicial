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
          Primera vez sin usuarios:
          <br />
          <code>pnpm seed</code> crea el administrador y imprime la contraseña.
          <br />
          Desde la web, el administrador puede dar de alta a más gente en{" "}
          <strong>Usuarios</strong>.
        </p>
      </div>
    </div>
  );
}
