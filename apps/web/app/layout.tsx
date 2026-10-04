import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getActor } from "@/lib/auth";
import { getReviewStats } from "@/lib/dataset";
import { registrarRender } from "@/lib/timings";
import { NavLinks } from "@/components/nav-links";
import { Shortcuts } from "@/components/shortcuts";
import { BackToTop } from "@/components/back-to-top";
import { TituloRuta } from "@/components/titulo-ruta";
import { DensityToggle } from "@/components/density-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MantiJudicial",
  description: "Análisis de jurisprudencia, legislación BOE y patrones de resultado",
};

const NAV: Array<{ href: string; label: string }> = [
  { href: "/", label: "Resumen" },
  { href: "/cases", label: "Casos" },
  { href: "/clientes", label: "Clientes" },
  { href: "/review", label: "Revisión" },
  { href: "/alertas", label: "Alertas" },
  { href: "/evolucion", label: "Evolución" },
  { href: "/search", label: "Búsqueda" },
  { href: "/laws", label: "Legislación" },
  { href: "/patterns", label: "Patrones" },
  { href: "/informes", label: "Informes" },
  { href: "/plazos", label: "Plazos" },
  { href: "/eval", label: "Calidad" },
  { href: "/ayuda", label: "Ayuda" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const inicio = performance.now();
  const cuerpo = await Promise.resolve(children);
  const store = await cookies();
  const authenticated = Boolean(store.get("mj_session")?.value);
  const actor = authenticated ? await getActor() : null;
  const pending = actor ? (await getReviewStats()).pending.length : 0;
  const items = NAV.map((item) =>
    item.href === "/review" && pending > 0 ? { ...item, badge: pending } : item,
  );
  if (actor?.role === "ORG_ADMIN") items.push({ href: "/users", label: "Usuarios" });
  registrarRender(performance.now() - inicio);

  return (
    <html lang="es">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('mj-tema');var claro=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches;if(t==='light'||(!t&&claro)){document.documentElement.setAttribute('data-theme','light');}if(localStorage.getItem('mj-densidad')==='compacta'){document.documentElement.setAttribute('data-densidad','compacta');}}catch(e){}})();",
          }}
        />
        <a href="#contenido" className="skip-link no-print">
          Saltar al contenido
        </a>
        <header className="top">
          <div className="wrap">
            <div className="brand">
              Manti<span>Judicial</span>
            </div>
            <div className="acciones-cabecera">
              <form
                action="/search"
                method="get"
                style={{ display: "flex", gap: 6, alignItems: "center" }}
                role="search"
              >
                <input
                  name="q"
                  placeholder="Buscar…"
                  aria-label="Buscar en casos, frases y artículos"
                  style={{ width: 150, fontSize: 13, padding: "5px 8px" }}
                />
              </form>
              <DensityToggle />
              <ThemeToggle />
              {authenticated ? (
                <LogoutButton />
              ) : (
                <Link href="/login" className="small">
                  Entrar
                </Link>
              )}
            </div>
          </div>
          <div className="wrap">
            <NavLinks items={items} />
          </div>
        </header>
        <main className="wrap" id="contenido">
          {cuerpo}
        </main>
        <Shortcuts />
        <BackToTop />
        <TituloRuta />
        <footer>
          <div className="wrap">
            Corpus de sentencias del Tribunal Supremo + texto consolidado del BOE. Los textos
            consolidados tienen carácter meramente informativo: para decisiones jurídicas debe
            consultarse la publicación oficial. La IA asiste al abogado; no sustituye su revisión.
            Acceso denegado por defecto: sin sesión no hay acceso a casos ni agregados.
            <br />
            <span className="small">
              <Link href="/ayuda">Ayuda</Link> · <Link href="/novedades">Novedades</Link> ·{" "}
              <Link href="/eval">Estado y coste</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
