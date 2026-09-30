export interface Tramite {
  id: string;
  nombre: string;
  dias: number;
  /** Artículo de la LEC, p. ej. "479.1". */
  articulo: string;
  bloque: string;
  /** Frase literal que debe aparecer en el texto del artículo (autoverificación). */
  verificacion: string;
  nota?: string;
}

/**
 * Plazos tomados del texto de la Ley de Enjuiciamiento Civil descargado del BOE
 * (laws/norms/BOE-A-2000-323.json). Cada entrada se autoverifica contra el
 * artículo en tiempo de ejecución.
 */
export const TRAMITES: Tramite[] = [
  {
    id: "casacion",
    nombre: "Recurso de casación",
    dias: 20,
    articulo: "479.1",
    bloque: "a479",
    verificacion: "recurso de casación se interpondrá ante el tribunal que haya dictado la resolución que se impugne dentro del plazo de veinte días contados desde el día siguiente a la notificación",
  },
  {
    id: "infraccion_procesal",
    nombre: "Recurso extraordinario por infracción procesal",
    dias: 20,
    articulo: "470.1",
    bloque: "a470",
    verificacion: "recurso extraordinario por infracción procesal se interpondrá ante el tribunal que haya dictado la resolución que se impugne dentro del plazo de veinte días",
  },
  {
    id: "apelacion",
    nombre: "Recurso de apelación",
    dias: 20,
    articulo: "458.1",
    bloque: "a458",
    verificacion: "recurso de apelación se interpondrá",
  },
  {
    id: "reposicion",
    nombre: "Recurso de reposición",
    dias: 5,
    articulo: "452.1",
    bloque: "a452",
    verificacion: "recurso de reposición deberá interponerse en el plazo de cinco días",
  },
  {
    id: "queja",
    nombre: "Recurso de queja (inadmisión de casación)",
    dias: 10,
    articulo: "495.1",
    bloque: "a495",
    verificacion: "recurso de queja se interpondrá ante el órgano al que corresponda resolver el recurso no tramitado, en el plazo de diez días",
  },
  {
    id: "nulidad",
    nombre: "Nulidad de actuaciones (indefensión)",
    dias: 20,
    articulo: "228",
    bloque: "a228",
    verificacion: "El plazo para pedir la nulidad será de veinte días",
  },
];

export interface Verificacion {
  ok: boolean;
  cita: string;
  falta: string | null;
}

/** Comprueba que el plazo declarado sigue estando en el texto del artículo. */
export function verificarTramite(articleText: string, tramite: Tramite): Verificacion {
  const text = articleText.replace(/\s+/g, " ");
  const needle = tramite.verificacion.replace(/\s+/g, " ");
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return { ok: false, cita: text.slice(0, 300), falta: needle };
  const start = Math.max(0, idx - 80);
  return { ok: true, cita: text.slice(start, idx + needle.length + 120), falta: null };
}

/** Festivos nacionales de fecha fija (las móviles: Semana Santa, deben añadirse). */
export const FESTIVOS_FIJOS = [
  "01-01",
  "01-06",
  "05-01",
  "08-15",
  "10-12",
  "11-01",
  "12-06",
  "12-08",
  "12-25",
];

export interface Calculo {
  fechaNotificacion: string;
  dias: number;
  excluyeInhabiles: boolean;
  incluyeAgosto: boolean;
  festivosExtra: string[];
}

export interface ResultadoCalculo {
  fechaLimite: string;
  diasContados: number;
  saltados: Array<{ fecha: string; motivo: string }>;
  avisos: string[];
}

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function motivoInhabil(date: Date, opciones: Calculo): string | null {
  const day = date.getUTCDay();
  if (day === 0) return "domingo";
  if (day === 6) return "sábado";
  const iso = toYmd(date);
  const mmdd = iso.slice(5);
  if (mmdd >= "12-24" && mmdd <= "12-31") return "24 de diciembre a 6 de enero";
  if (mmdd >= "01-01" && mmdd <= "01-06") return "24 de diciembre a 6 de enero";
  if (!opciones.incluyeAgosto && mmdd.startsWith("08-")) return "agosto (art. 130.2)";
  if (FESTIVOS_FIJOS.includes(mmdd)) return "festivo nacional";
  if (opciones.festivosExtra.includes(iso)) return "festivo indicado";
  return null;
}

/**
 * Cómputo según los arts. 133.1 y 133.2 LEC: empieza el día siguiente a la
 * notificación, se cuentan los inhábiles y el día del vencimiento.
 */
export function calcularFechaLimite(opciones: Calculo): ResultadoCalculo {
  const inicio = new Date(`${opciones.fechaNotificacion}T00:00:00Z`);
  if (Number.isNaN(inicio.getTime())) {
    return { fechaLimite: "", diasContados: 0, saltados: [], avisos: ["Fecha de notificación no válida"] };
  }
  const saltados: Array<{ fecha: string; motivo: string }> = [];
  const avisos: string[] = [];
  let contados = 0;
  const cursor = new Date(inicio.getTime());

  while (contados < opciones.dias) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const motivo = opciones.excluyeInhabiles ? motivoInhabil(cursor, opciones) : null;
    if (motivo) {
      saltados.push({ fecha: toYmd(cursor), motivo });
      continue;
    }
    contados += 1;
  }

  if (opciones.excluyeInhabiles) {
    avisos.push(
      "Se excluyen sábados, domingos, del 24 de diciembre al 6 de enero, agosto y festivos nacionales de fecha fija (arts. 130.2 y 133.2 LEC).",
    );
    avisos.push(
      "Faltan los festivos de tu comunidad autónoma y localidad: revísalos antes de presentar.",
    );
    if (!opciones.incluyeAgosto) {
      avisos.push(
        "Agosto se ha tratado como inhábil (art. 130.2 LEC); marca la casilla si el órgano ha habilitado días (art. 131 LEC).",
      );
    }
  }
  avisos.push("Los plazos de leyes especiales (laboral, contencioso, mercantil) no siguen este cómputo.");

  return {
    fechaLimite: toYmd(cursor),
    diasContados: contados,
    saltados: saltados.slice(0, 40),
    avisos,
  };
}

export function fechaEs(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
