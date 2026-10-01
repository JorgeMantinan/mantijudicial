import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="section" style={{ marginTop: 40 }}>
      <h1>Página no encontrada</h1>
      <p className="lead">
        Esa dirección no corresponde a ninguna página del sistema: quizá un caso fue archivado o el
        enlace está cortado.
      </p>
      <ul className="small">
        <li>
          <Link href="/">Ir al resumen</Link>
        </li>
        <li>
          <Link href="/cases">Ver los casos</Link>
        </li>
        <li>
          <Link href="/search">Búsqueda (o pulsa /)</Link>
        </li>
        <li>
          <Link href="/ayuda">Ayuda</Link>
        </li>
      </ul>
    </div>
  );
}
