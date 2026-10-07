export interface FraseCaso {
  caseId: string;
  outcome: string;
  texto: string;
}

export interface GrupoFrases {
  ejemplo: string;
  casos: Array<{ caseId: string; outcome: string; texto: string }>;
  distribucion: Record<string, number>;
  total: number;
  /** Proporción de casos del grupo que acaban igual (0..1). */
  homogenea: number;
}

/** Frases de cajón (casi en todos los casos): no sirven para asociar nada.
 * Se comprueba por prefijo para pillar también "desestimarse", "costas"… */
const STEMS_OUTCOME = [
  "desestim",
  "cost",
  "deposit",
  "formul",
  "oposicion",
  "confirm",
  "revoc",
  "casacion",
  "condena",
  "apelacion",
];

const VACIAS = new Set([
  "el","la","los","las","un","una","unos","unas","de","del","al","a","en","con","por","para","que",
  "se","su","sus","es","son","estaba","estaban","fue","fueron","era","como","pero","mas","muy",
  "esta","este","esto","ese","esa","cuando","entre","sobre","desde","hasta","tras","sin","despues",
  "antes","tambien","ya","no","ni","o","e","u","lo","le","les","nos","yo","tu","ellos","ellas",
  "habia","han","ha","haya","segun","conforme","articulo","art","sentencia","parte","demandante",
  "demandado","recurrente","apelante","numero","nro","anno",
]);

/** Tokens significativos en minúsculas y sin acentos. */
export function normalizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !VACIAS.has(token));
}

/** Solape de Jaccard restringido al conjunto menor (0..1): castiga menos
 * cuando una frase es un subconjunto de otra (muy común entre enunciados). */
export function similitud(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comunes = 0;
  for (const token of a) if (b.has(token)) comunes += 1;
  return comunes / Math.min(a.size, b.size);
}

/**
 * Agrupa frases parecidas de distintos casos (comparación voraz contra el
 * representante de cada grupo) y devuelve las que se repiten.
 */
export function agruparFrases(
  frases: FraseCaso[],
  minimoCasos = 3,
  umbral = 0.5,
  maximoPorGrupo = 6,
  homogeneidadMinima = 0,
): GrupoFrases[] {
  interface Grupo {
    rep: Set<string>;
    ejemplo: string;
    casos: Map<string, { outcome: string; texto: string }>;
  }
  const grupos: Grupo[] = [];

  for (const frase of frases) {
    const tokens = new Set(normalizar(frase.texto));
    if (tokens.size < 5) continue;
    if ([...tokens].some((token) => STEMS_OUTCOME.some((stem) => token.startsWith(stem)))) continue;
    let grupo = null as Grupo | null;
    for (const candidato of grupos) {
      if (similitud(tokens, candidato.rep) >= umbral) {
        grupo = candidato;
        break;
      }
    }
    if (!grupo) {
      const nuevo: Grupo = { rep: tokens, ejemplo: frase.texto, casos: new Map() };
      nuevo.casos.set(frase.caseId, { outcome: frase.outcome, texto: frase.texto });
      grupos.push(nuevo);
      continue;
    }
    if (grupo.casos.has(frase.caseId)) continue;
    if (grupo.casos.size >= maximoPorGrupo) continue;
    // El texto de cada caso se guarda para poder elegir un ejemplo que no
    // pertenezca a un caso ajeno al despacho que lo consulta.
    grupo.casos.set(frase.caseId, { outcome: frase.outcome, texto: frase.texto });
  }

  const salida: GrupoFrases[] = [];
  for (const grupo of grupos) {
    if (grupo.casos.size < minimoCasos) continue;
    const distribucion: Record<string, number> = {};
    const casos: Array<{ caseId: string; outcome: string; texto: string }> = [];
    for (const [caseId, dato] of grupo.casos) {
      distribucion[dato.outcome] = (distribucion[dato.outcome] ?? 0) + 1;
      casos.push({ caseId, outcome: dato.outcome, texto: dato.texto });
    }
    const homogenea = Math.max(...Object.values(distribucion)) / grupo.casos.size;
    if (homogenea < homogeneidadMinima) continue;
    salida.push({
      ejemplo: grupo.ejemplo,
      casos,
      distribucion,
      total: grupo.casos.size,
      homogenea,
    });
  }
  return salida.sort(
    (a, b) => b.homogenea - a.homogenea || b.total - a.total,
  );
}
