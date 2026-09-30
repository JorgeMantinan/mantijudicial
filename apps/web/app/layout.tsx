import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getActor } from "@/lib/auth";
import { getReviewStats } from "@/lib/dataset";
import { Shortcuts } from "@/components/shortcuts";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MantiJudicial",
  description: "Análisis de jurisprudencia, legislación BOE y patrones de resultado",
};

const NAV: Array<{ titulo?: string; links: Array<{ href: string; label: string }> }> = [
  {
    links: [
      { href: "/", label: "Resumen" },
      { href: "/cases", label: "Casos" },
      { href: "/review", label: "Revisión" },
      { href: "/alertas", label: "Alertas" },
    ],
  },
  {
    titulo: "Análisis",
    links: [
      { href: "/evolucion", label: "Evolución" },
      { href: "/search", label: "Búsqueda" },
      { href: "/laws", label: "Legislación" },
      { href: "/patterns", label: "Patrones" },
      { href: "/informes", label: "Informes" },
    ],
  },
  {
    titulo: "Herramientas",
    links: [
      { href: "/plazos", label: "Plazos" },
      { href: "/eval", label: "Evaluación" },
      { href: "/ayuda", label: "Ayuda" },
    ],
  },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const authenticated = Boolean(store.get("mj_session")?.value);
  const actor = authenticated ? await getActor() : null;
  const grupos =
    actor?.role === "ORG_ADMIN"
      ? NAV.map((grupo, index) =>
          index === NAV.length - 1
            ? { ...grupo, links: [...grupo.links, { href: "/users", label: "Usuarios" }] }
            : grupo,
        )
      : NAV;
  const pending = authenticated ? (await getReviewStats()).pending.length : 0;

  return (
    <html lang="es">
      <body>
        <header className="top">
          <div className="wrap">
            <div className="brand">
              Manti<span>Judicial</span>
            </div>
            <nav
              style={{
                display: "flex",
                gap: 18,
                flex: 1,
                alignItems: "center",
                flexWrap: "wrap",
                rowGap: 6,
              }}
            >
              {grupos.map((grupo, index) => (
                <span
                  key={grupo.titulo ?? "principal"}
                  style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}
                >
                  {index > 0 && (
                    <span aria-hidden style={{ width: 1, height: 16, background: "var(--line)" }} />
                  )}
                  {grupo.titulo && (
                    <span
                      className="small muted"
                      style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}
                    >
                      {grupo.titulo}
                    </span>
                  )}
                  {grupo.links.map((item) => (
                    <Link key={item.href} href={item.href}>
                      {item.label}
                      {item.href === "/review" && pending > 0 && (
                        <span className="badge warn" style={{ marginLeft: 6 }}>
                          {pending}
                        </span>
                      )}
                    </Link>
                  ))}
                </span>
              ))}
            </nav>
            {authenticated ? (
              <LogoutButton />
            ) : (
              <Link href="/login" className="small">
                Entrar
              </Link>
            )}
          </div>
        </header>
        <main className="wrap">{children}</main>
        <Shortcuts />
        <footer>
          <div className="wrap">
            Corpus de sentencias del Tribunal Supremo + texto consolidado del BOE. Los textos
            consolidados tienen carácter meramente informativo: para decisiones jurídicas debe
            consultarse la publicación oficial. La IA asiste al abogado; no sustituye su revisión.
            Acceso denegado por defecto: sin sesión no hay acceso a casos ni agregados.
          </div>
        </footer>
      </body>
    </html>
  );
}
