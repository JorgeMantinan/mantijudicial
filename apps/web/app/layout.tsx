import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getActor } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "MantiJudicial",
  description: "Análisis de jurisprudencia, legislación BOE y patrones de resultado",
};

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/cases", label: "Casos" },
  { href: "/search", label: "Búsqueda" },
  { href: "/laws", label: "Legislación" },
  { href: "/patterns", label: "Patrones" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const authenticated = Boolean(store.get("mj_session")?.value);
  const actor = authenticated ? await getActor() : null;
  const links = actor?.role === "ORG_ADMIN" ? [...NAV, { href: "/users", label: "Usuarios" }] : NAV;

  return (
    <html lang="es">
      <body>
        <header className="top">
          <div className="wrap">
            <div className="brand">
              Manti<span>Judicial</span>
            </div>
            <nav style={{ display: "flex", gap: 18, flex: 1 }}>
              {links.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
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
