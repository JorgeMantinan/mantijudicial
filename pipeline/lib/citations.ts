import { spanishNumberToInt } from "./spanish_number.js";

export interface LawBlock {
  id: string;
  tipo: string;
  titulo: string;
  fecha_vigencia: string;
  texto: string;
}

export interface LawNorm {
  boe_id: string;
  titulo: string;
  blocks: LawBlock[];
}

export type NormaKind = "sigla" | "numero_oficial" | "ai_unverified" | "non_boe" | "unknown";

export interface NormaRef {
  identificador: string;
  titulo: string;
  ambito: string;
  vigencia_agotada: string;
}

export interface NormaResolution {
  boe_id: string | null;
  kind: NormaKind;
  sigla: string;
}

const SIGLAS: Record<string, string> = {
  cc: "BOE-A-1889-4763",
  "codigo civil": "BOE-A-1889-4763",
  ccom: "BOE-A-1885-6627",
  "codigo de comercio": "BOE-A-1885-6627",
  lec: "BOE-A-2000-323",
  "ley de enjuiciamiento civil": "BOE-A-2000-323",
  lecrim: "BOE-A-1882-6036",
  "ley de enjuiciamiento criminal": "BOE-A-1882-6036",
  cp: "BOE-A-1995-25444",
  "codigo penal": "BOE-A-1995-25444",
  lau: "BOE-A-1994-26003",
  "ley de arrendamientos urbanos": "BOE-A-1994-26003",
  lph: "BOE-A-1960-10906",
  "ley sobre propiedad horizontal": "BOE-A-1960-10906",
  lopj: "BOE-A-1985-12666",
  "ley organica del poder judicial": "BOE-A-1985-12666",
  ce: "BOE-A-1978-31229",
  constitucion: "BOE-A-1978-31229",
  "constitucion espanola": "BOE-A-1978-31229",
  lsc: "BOE-A-2010-10544",
  "ley de sociedades de capital": "BOE-A-2010-10544",
  lcs: "BOE-A-1980-22501",
  "contrato de seguro": "BOE-A-1980-22501",
  "ley 50/1980": "BOE-A-1980-22501",
  lh: "BOE-A-1946-2453",
  "ley hipotecaria": "BOE-A-1946-2453",
  "reglamento hipotecario": "BOE-A-1947-3843",
  lmv: "BOE-A-1988-18764",
  "mercado de valores": "BOE-A-1988-18764",
  trlpi: "BOE-A-1996-8930",
  "rdleg 1/1996": "BOE-A-1996-8930",
  cambiaria: "BOE-A-1985-14880",
  "ley cambiaria": "BOE-A-1985-14880",
  "ley cambiaria y del cheque": "BOE-A-1985-14880",
  lgdcu: "BOE-A-2007-20555",
  trlgdcu: "BOE-A-2007-20555",
  "rdl 1/2007": "BOE-A-2007-20555",
  "rdleg 1/2007": "BOE-A-2007-20555",
  "real decreto legislativo 1/2007": "BOE-A-2007-20555",
  "ley de arbitraje": "BOE-A-2003-23646",
  "jurisdiccion voluntaria": "BOE-A-2015-7391",
};

const NON_BOE_EXAMPLES = [
  "directiva",
  "reglamento (ue)",
  "reglamento ue",
  "carta de derechos",
  "pecl",
  "unidroit",
  "principios",
  "tratado",
  "italiano",
  "portugues",
  "comision europea",
  "proyecto de codigo",
];

const NON_BOE_EXACT = new Set(["tue", "tfue", "cje", "tjue", "duda prejudicial"]);

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

export function normalizeSigla(norma: string): string {
  return normalizeText(norma)
    .replace(/\(.*?\)/g, " ")
    .replace(/[,;:.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksNonBoe(norma: string): boolean {
  const normalized = normalizeSigla(norma);
  return NON_BOE_EXAMPLES.some((word) => normalized.includes(word));
}

const TYPE_WORDS = new Set([
  "ley",
  "leyes",
  "real",
  "decreto",
  "legislativo",
  "organica",
  "ordinaria",
  "refundido",
  "texto",
  "articulo",
  "art",
  "norma",
  "disposicion",
  "numero",
  "nro",
  "del",
  "de",
  "la",
  "el",
  "los",
  "las",
  "y",
  "o",
  "en",
  "por",
  "para",
  "con",
  "sobre",
  "al",
  "siguiente",
]);

export function corroborationTokens(norma: string): string[] {
  const folded = normalizeText(norma);
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean);
  // Los acrónimos en mayúsculas del propio texto (LMV, LDCU, BdE) no suelen
  // aparecer en el título de la norma: no sirven para corroborar y no deben
  // descartar candidatos correctos.
  const acronyms = new Set(
    (norma.match(/[A-ZÁÉÍÓÚÜÑ]{2,}/g) ?? []).map((item) => item.toLowerCase()),
  );
  const out: string[] = [];
  for (const token of words) {
    if (token.length < 3) continue;
    if (TYPE_WORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (acronyms.has(token)) continue;
    out.push(token);
  }
  return [...new Set(out)];
}

const SIGLA_KEYS_BY_LENGTH = Object.keys(SIGLAS).sort((a, b) => b.length - a.length);

/** "LOPJ, disposición adicional 15.ª" debe resolver como LOPJ. */
function findBySiglaPrefix(normalized: string): string | undefined {
  for (const key of SIGLA_KEYS_BY_LENGTH) {
    if (normalized === key || normalized.startsWith(`${key} `)) return SIGLAS[key];
  }
  return undefined;
}

export function resolveNorma(
  norma: string,
  numeroOficial: Map<string, NormaRef[]>,
): NormaResolution {
  const normalized = normalizeSigla(norma);
  if (!normalized) return { boe_id: null, kind: "unknown", sigla: normalized };

  const direct = SIGLAS[normalized] ?? findBySiglaPrefix(normalized);
  if (direct) return { boe_id: direct, kind: "sigla", sigla: normalized };

  if (NON_BOE_EXACT.has(normalized) || looksNonBoe(norma)) {
    return { boe_id: null, kind: "non_boe", sigla: normalized };
  }

  const numero = /(\d{1,4}\/\d{4})/.exec(normalized);
  if (numero?.[1]) {
    const candidates = numeroOficial.get(numero[1].replace(/\s/g, "")) ?? [];
    const tokens = corroborationTokens(norma);
    let matches = candidates;
    if (tokens.length > 0) {
      matches = candidates.filter((candidate) => {
        const titulo = normalizeText(candidate.titulo);
        return tokens.some((token) => titulo.includes(token));
      });
      if (matches.length === 0) return { boe_id: null, kind: "unknown", sigla: normalized };
    }
    const estatal = matches.filter((candidate) => candidate.ambito === "1");
    if (estatal.length > 0) matches = estatal;
    const vigentes = matches.filter((candidate) => candidate.vigencia_agotada === "N");
    if (vigentes.length > 0) matches = vigentes;
    const chosen = matches[0];
    if (chosen) return { boe_id: chosen.identificador, kind: "numero_oficial", sigla: normalized };
  }

  return { boe_id: null, kind: "unknown", sigla: normalized };
}

const SIGLA_LIKE = /^[A-Za-zÁÉÍÓÚÜÑñ]{1,12}$/;

export function splitCombinedNorma(norma: string): string[] {
  const parts = norma
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return [norma];
  if (!parts.every((part) => SIGLA_LIKE.test(part))) return [norma];
  return parts;
}

export function parseArticleNumbers(raw: string): number[] {
  if (!raw) return [];
  const cleaned = raw.replace(/\u00ba|\u00b0/g, "").trim();
  const parts = cleaned.split(/[,;]|\s+y\s+|\s+e\s+/i);
  const out: number[] = [];
  for (const part of parts) {
    const token = part.replace(/^[^\d]+/, "").trim();
    if (!token) continue;
    const miles = /^(\d{1,3})\.(\d{3})(?!\d)/.exec(token);
    if (miles?.[1] && miles[2]) {
      out.push(Number(`${miles[1]}${miles[2]}`));
      continue;
    }
    const simple = /^(\d+)/.exec(token);
    if (simple?.[1]) out.push(Number(simple[1]));
  }
  return [...new Set(out)];
}

export function buildArticleIndex(blocks: LawBlock[]): Map<number, string> {
  const index = new Map<number, string>();
  for (const block of blocks) {
    const number = articleNumberOf(block);
    if (number === null) continue;
    if (!index.has(number)) index.set(number, block.id);
  }
  return index;
}

function articleNumberOf(block: LawBlock): number | null {
  const tituloDigits = /(?:art(?:iculo)?\.?)\s*(\d+)/i.exec(block.titulo ?? "");
  if (tituloDigits?.[1]) return Number(tituloDigits[1]);

  const tituloWords = /art(?:iculo)?\.?\s+(.+)$/i.exec(block.titulo ?? "");
  if (tituloWords?.[1]) {
    const value = spanishNumberToInt(tituloWords[1]);
    if (value !== null) return value;
  }

  const idDigits = /^a(?:rt)?(\d+)/i.exec(block.id ?? "");
  if (idDigits?.[1]) return Number(idDigits[1]);

  const idWords = /^a(.+)$/i.exec(block.id ?? "");
  if (idWords?.[1]) return spanishNumberToInt(idWords[1]);
  return null;
}

export type QuoteCheck = "MATCH" | "MISMATCH" | "NOT_CHECKED";

export function checkQuote(articleText: string, quote: string | undefined | null): QuoteCheck {
  if (!quote || quote === "UNKNOWN" || quote.trim().length < 25) return "NOT_CHECKED";
  const hay = normalizeText(articleText);
  const needle = normalizeText(quote);
  if (hay.includes(needle)) return "MATCH";
  const words = needle.split(" ").filter((word) => word.length > 4);
  if (words.length === 0) return "NOT_CHECKED";
  const hits = words.filter((word) => hay.includes(word)).length;
  return hits / words.length >= 0.8 ? "MATCH" : "MISMATCH";
}
