/**
 * Siglas de normas comprobables contra el propio PDF. Se comparten entre el
 * detector de citas, la evaluación y el enriquecimiento del corpus.
 */
/**
 * Siglas comprobables contra el propio PDF. La mención del nombre largo solo
 * cuenta si va precedida de una referencia de artículo: "la Constitución"
 * aparece en la fórmula de todo fallo sin que el caso la cite como norma.
 * `names` se usa para normalizar el campo `norma` que devuelve la IA, donde el
 * nombre largo sí es una citación.
 */
export interface SiglaEntry {
  sigla: string;
  boe_id: string;
  pattern: RegExp;
  names: string[];
}

export const CHECKABLE_SIGLAS: SiglaEntry[] = [
  {
    sigla: "CC",
    boe_id: "BOE-A-1889-4763",
    pattern: /(?:\bCC\b)|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?c[oó]digo civil/i,
    names: ["codigo civil"],
  },
  {
    sigla: "CCom",
    boe_id: "BOE-A-1885-6627",
    pattern: /(?:\bCCom\b)|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?c[oó]digo de comercio/i,
    names: ["codigo de comercio"],
  },
  {
    sigla: "LEC",
    boe_id: "BOE-A-2000-323",
    pattern: /\bLEC\b|enjuiciamiento civil/i,
    names: ["enjuiciamiento civil"],
  },
  {
    sigla: "LECrim",
    boe_id: "BOE-A-1882-6036",
    pattern: /\bLECrim\b|enjuiciamiento criminal/i,
    names: ["enjuiciamiento criminal"],
  },
  {
    sigla: "CP",
    boe_id: "BOE-A-1995-25444",
    pattern: /(?:\bCP\b)|c[oó]digo penal/i,
    names: ["codigo penal"],
  },
  {
    sigla: "LOPJ",
    boe_id: "BOE-A-1985-12666",
    pattern:
      /(?:\bLOPJ\b)|ley\s+org[áa]nica\s+(?:del\s+)?poder\s+judicial|ley\s+org[áa]nica\s+6\/1985|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?poder judicial/i,
    names: ["poder judicial", "ley organica 6/1985"],
  },
  {
    sigla: "CE",
    boe_id: "BOE-A-1978-31229",
    pattern:
      /(?<![\w/])\bCE\b(?![\w/])|constituci[oó]n espa[nñ]ola|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?constituci[oó]n/i,
    names: ["constitucion espanola", "constitucion"],
  },
  {
    sigla: "LAU",
    boe_id: "BOE-A-1994-26003",
    pattern:
      /(?:\bLAU\b)|ley\s+29\/1994|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?arrendamientos urbanos/i,
    names: ["arrendamientos urbanos", "ley 29/1994"],
  },
  {
    sigla: "LPH",
    boe_id: "BOE-A-1960-10906",
    pattern:
      /(?:\bLPH\b)|ley\s+49\/1960|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?propiedad horizontal/i,
    names: ["propiedad horizontal", "ley 49/1960"],
  },
  {
    sigla: "LGDCU",
    boe_id: "BOE-A-2007-20555",
    pattern:
      /(?:\bLGDCU\b|\bTRLGDCU\b)|ley\s+26\/1984|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?consumidores y usuarios/i,
    names: ["consumidores y usuarios", "ley 26/1984"],
  },
  {
    sigla: "LSC",
    boe_id: "BOE-A-2010-10544",
    pattern: /(?:\bLSC\b)|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?sociedades de capital/i,
    names: ["sociedades de capital"],
  },
  {
    sigla: "LCS",
    boe_id: "BOE-A-1980-22501",
    pattern: /(?:\bLCS\b)|ley\s+50\/1980|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?contrato de seguro/i,
    names: ["contrato de seguro", "ley 50/1980"],
  },
  {
    sigla: "LMV",
    boe_id: "BOE-A-1988-18764",
    pattern: /(?:\bLMV\b)|ley\s+24\/1988|art(?:[íi]culo)?\.?\s*\d+[\s\S]{0,60}?mercado de valores/i,
    names: ["mercado de valores", "ley 24/1988"],
  },
  { sigla: "LH", boe_id: "BOE-A-1946-2453", pattern: /ley hipotecaria/i, names: ["ley hipotecaria"] },
];

export function detectSiglasInText(text: string): string[] {
  const found = new Set<string>();
  for (const { sigla, pattern } of CHECKABLE_SIGLAS) {
    if (pattern.test(text)) found.add(sigla);
  }
  return [...found];
}

/** Normas que el propio PDF demuestra que se citan (para el golden dataset). */
export function boeIdsInText(text: string): string[] {
  const siglas = new Set(detectSiglasInText(text));
  const out: string[] = [];
  for (const item of CHECKABLE_SIGLAS) {
    if (!siglas.has(item.sigla)) continue;
    // Si el caso cita la Ley 26/1984, esa norma no está en el corpus: no se
    // puede pedir al pipeline que la resuelva, así que no se espera nada.
    if (item.sigla === "LGDCU" && /26\/1984/.test(text)) continue;
    out.push(item.boe_id);
  }
  return out;
}

export function siglaOfNorma(norma: string): string | null {
  const normalized = norma
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) return null;
  // Instrumento europeo: no es una norma del BOE aunque termine en /CE.
  if (
    /(directiva|reglamento\s*\(ce\)|reglamento\s+ce|decisi[oó]n|[0-9]\/[0-9]+\/ce\b)/.test(normalized)
  ) {
    return null;
  }
  for (const entry of CHECKABLE_SIGLAS) {
    const own = entry.sigla.toLowerCase();
    if (normalized === own) return entry.sigla;
    if (normalized.split(/[^a-z]+/).includes(own)) return entry.sigla;
    if (entry.names.some((name) => normalized.includes(name))) return entry.sigla;
  }
  return null;
}
