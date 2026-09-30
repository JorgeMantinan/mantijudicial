import Link from "next/link";
import { requireActor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BLOQUES: Array<{ titulo: string; puntos: Array<{ texto: string; href?: string }> }> = [
  {
    titulo: "Ahora mismo",
    puntos: [
      { texto: "Secciones plegables en la ficha (comparaciones, leyes citadas, trazabilidad)." },
      { texto: "Comparación de periodos en el informe, con delta.", href: "/informes" },
      { texto: "Calidad del corpus (PDF sin texto, stale, sin revisar).", href: "/eval" },
      { texto: "Archivar casos sin borrar nada (botón en la ficha).", href: "/cases" },
      { texto: "Regresión automática de toda la web (scripts/smoke.ps1)." },
    ],
  },
  {
    titulo: "Búsqueda y análisis",
    puntos: [
      { texto: "Coincidencia exacta por ECLI, ROJ, nº de resolución o nº de recurso.", href: "/search" },
      { texto: "Búsquedas guardadas con nombre y resaltado de términos.", href: "/search" },
      { texto: "Ficha de tema: cronología, argumentos aceptados/rechazados y leyes.", href: "/evolucion" },
      { texto: "Evolución jurisprudencial por tema y alertas de doctrina contradictoria.", href: "/patterns" },
      { texto: "Índice de la norma con filtro al vuelo y buscador de artículos.", href: "/laws" },
    ],
  },
  {
    titulo: "Informes y salidas",
    puntos: [
      { texto: "Informe del periodo imprimible con matriz tema × trimestre.", href: "/informes" },
      { texto: "CSV de casos y de informes (para Excel) con tus filtros.", href: "/cases" },
      { texto: "Dossier para el cliente e informe comparativo imprimibles." },
      { texto: "Coste de IA en vivo y calidad del corpus.", href: "/eval" },
    ],
  },
  {
    titulo: "Trabajo del despacho",
    puntos: [
      { texto: "Revisión masiva (marcar varios casos de una vez) y atajo N.", href: "/review" },
      { texto: "Panel de alertas: leyes cambiadas tras tus sentencias y criterio dividido.", href: "/alertas" },
      { texto: "Carga de revisión por persona y auditoría de acciones.", href: "/users" },
      { texto: "Subida de varios PDF, con detección de duplicados por huella." },
      { texto: "Atajos de teclado globales (pulsa ? para verlos)." },
    ],
  },
  {
    titulo: "Seguridad y base",
    puntos: [
      { texto: "Aislamiento por despacho verificado en todas las páginas de agregados." },
      { texto: "Permisos denegados por defecto, compartir casos con caducidad y MFA." },
      { texto: "Despliegue preparado para Render (rama de datos aparte); Vercel descartado." },
    ],
  },
];

export default async function NovedadesPage() {
  await requireActor();

  return (
    <>
      <h1>Novedades</h1>
      <p className="lead">
        Qué se ha ido añadiendo a la plataforma, agrupado por áreas. La ayuda de uso está en{" "}
        <Link href="/ayuda">/ayuda</Link>.
      </p>

      {BLOQUES.map((bloque) => (
        <div className="section" key={bloque.titulo}>
          <h2>{bloque.titulo}</h2>
          <ul className="small">
            {bloque.puntos.map((punto) => (
              <li key={punto.texto}>
                {punto.href ? <Link href={punto.href}>{punto.texto}</Link> : punto.texto}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="small muted">
        El detalle técnico de cada cambio está en los commits del repositorio; esto es la vista
        para quien usa la plataforma.
      </p>
    </>
  );
}
