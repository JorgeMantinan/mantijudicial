import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor) redirect("/");

  return (
    <>
      <h1>Entrar</h1>
      <p className="lead">
        Acceso al análisis de jurisprudencia. Denegación por defecto: sin sesión no hay acceso a
        casos, búsquedas ni agregados.
      </p>
      <div className="section" style={{ maxWidth: 520 }}>
        <Suspense fallback={<p className="muted small">Cargando…</p>}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="small muted">
        Si todavía no hay usuarios, inicialízalos con <span className="mono">pnpm seed</span>.
      </p>
    </>
  );
}
