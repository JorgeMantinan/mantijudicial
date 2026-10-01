"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
}

/** Menú principal en una sola línea, con la pestaña activa resaltada. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav-principal" aria-label="Menú principal">
      {items.map((item) => {
        const activo =
          item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={activo ? "activo" : undefined}
            aria-current={activo ? "page" : undefined}
          >
            {item.label}
            {item.badge ? <span className="badge warn">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
