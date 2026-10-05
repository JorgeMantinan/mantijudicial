const STOPWORDS = new Set([
  "de",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "u",
  "e",
  "en",
  "con",
  "por",
  "para",
  "del",
  "al",
  "se",
  "que",
  "lo",
  "le",
  "les",
  "su",
  "sus",
  "es",
  "son",
  "ser",
  "esta",
  "este",
  "estos",
  "estas",
  "ese",
  "esa",
  "esos",
  "esas",
  "aquel",
  "aquella",
  "como",
  "mas",
  "pero",
  "sino",
  "entre",
  "sobre",
  "desde",
  "hasta",
  "durante",
  "muy",
  "ya",
  "tambien",
  "no",
  "ni",
  "sin",
  "segun",
  "todo",
  "todos",
  "toda",
  "todas",
  "otro",
  "otra",
  "otros",
  "otras",
  "cuyo",
  "cuya",
  "respecto",
  "contra",
  "cuyo",
  "mismo",
  "misma",
  "tales",
  "tal",
]);

export interface SearchDoc {
  id: string;
  kind: "case" | "article" | "holding";
  title: string;
  body: string;
  meta: Record<string, string | undefined>;
}

export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  score: number;
  matchedTerms: string[];
  phraseMatch: boolean;
  snippet: string;
  meta: Record<string, string | undefined>;
}

export interface SearchOptions {
  kinds?: string[];
  limit?: number;
  filters?: Record<string, string>;
  /** Se aplica durante la puntuación: lo que no pasa no aparece ni se cuenta. */
  allow?: (doc: SearchDoc) => boolean;
}

interface IndexData {
  docs: Array<{ doc: SearchDoc; length: number }>;
  postings: Map<string, Array<{ doc: number; tf: number }>>;
  docFreq: Map<string, number>;
  totalLength: number;
}

/** Tabla de marcas latinas (á→a…) que no cambian la longitud. Un replace de
 * regex en toda la cadena es ~10× más rápido que normalize() carácter a
 * carácter (que era el cuello de botella del build del índice). */
const FOLD_MAPA: Record<string, string> = {
  "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a",
  "è": "e", "é": "e", "ê": "e", "ë": "e",
  "ì": "i", "í": "i", "î": "i", "ï": "i",
  "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o",
  "ù": "u", "ú": "u", "û": "u", "ü": "u",
  "ý": "y", "ç": "c", "ñ": "n",
};
const FOLD_RE = /[àáâãäåèéêëìíîïòóôõöùúûüýçñ]/g;

export function foldPreservingLength(text: string): string {
  return text.toLowerCase().replace(FOLD_RE, (char) => FOLD_MAPA[char] ?? char);
}

function variants(token: string): string[] {
  const out = [token];
  if (token.length > 3 && token.endsWith("s")) out.push(token.slice(0, -1));
  if (token.length > 4 && token.endsWith("es")) out.push(token.slice(0, -2));
  return out;
}

export function tokenize(text: string): string[] {
  const folded = foldPreservingLength(text);
  const raw = folded.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
  const out: string[] = [];
  for (const token of raw) {
    if (token.length < 2 && !/\d/.test(token)) continue;
    if (STOPWORDS.has(token)) continue;
    for (const variant of variants(token)) out.push(variant);
  }
  return out;
}

export function buildIndex(docs: SearchDoc[]): IndexData {
  const postings = new Map<string, Array<{ doc: number; tf: number }>>();
  const docFreq = new Map<string, number>();
  const indexed: Array<{ doc: SearchDoc; length: number }> = [];
  let totalLength = 0;

  docs.forEach((doc, position) => {
    const titleTokens = tokenize(doc.title);
    const bodyTokens = tokenize(doc.body);
    const tokens = [...titleTokens, ...titleTokens, ...titleTokens, ...bodyTokens];
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    for (const [token, tf] of counts) {
      const list = postings.get(token) ?? [];
      list.push({ doc: position, tf });
      postings.set(token, list);
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
    totalLength += tokens.length;
    indexed.push({ doc, length: tokens.length });
  });

  return { docs: indexed, postings, docFreq, totalLength };
}

function idf(index: IndexData, term: string): number {
  const n = index.docs.length;
  const df = index.docFreq.get(term) ?? 0;
  if (df === 0) return 0;
  return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

function matchesFilters(doc: SearchDoc, filters: Record<string, string> | undefined): boolean {
  if (!filters) return true;
  for (const [key, value] of Object.entries(filters)) {
    const actual = doc.meta[key];
    if (!actual) return false;
    if (value.includes("|")) {
      if (!value.split("|").includes(actual)) return false;
    } else if (actual !== value) {
      return false;
    }
  }
  return true;
}

function snippetFor(text: string, terms: string[], foldedPrefolded?: string): string {
  const folded = foldedPrefolded ?? foldPreservingLength(text);
  let position = -1;
  for (const term of terms) {
    const found = folded.indexOf(term);
    if (found >= 0 && (position < 0 || found < position)) position = found;
  }
  if (position < 0) return text.slice(0, 220).replace(/\s+/g, " ").trim();
  const start = Math.max(0, position - 90);
  const end = Math.min(text.length, position + 180);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

export function search(index: IndexData, query: string, options: SearchOptions = {}): SearchHit[] {
  const limit = options.limit ?? 10;
  const queryTokens = [...new Set(tokenize(query))];
  if (queryTokens.length === 0) return [];

  const k1 = 1.2;
  const b = 0.75;
  const avgLength = index.docs.length > 0 ? index.totalLength / index.docs.length : 1;
  const scores = new Map<number, { score: number; matched: Set<string> }>();
  const foldedQuery = foldPreservingLength(query).trim();

  for (const term of queryTokens) {
    const postings = index.postings.get(term);
    if (!postings) continue;
    const termIdf = idf(index, term);
    for (const posting of postings) {
      const entry = index.docs[posting.doc];
      if (!entry) continue;
      if (!matchesFilters(entry.doc, options.filters)) continue;
      if (options.allow && !options.allow(entry.doc)) continue;
      if (options.kinds && !options.kinds.includes(entry.doc.kind)) continue;
      const norm = posting.tf * (k1 + 1);
      const denom = posting.tf + k1 * (1 - b + (b * entry.length) / avgLength);
      const current = scores.get(posting.doc) ?? { score: 0, matched: new Set<string>() };
      current.score += termIdf * (norm / denom);
      current.matched.add(term);
      scores.set(posting.doc, current);
    }
  }

  // 1) Se puntúa sin plegar nada (el texto plegado ya no se guarda en el
  //    índice: era una copia entera del corpus en RAM, ~300 MB).
  const parciales: Array<{
    entry: { doc: SearchDoc; length: number };
    score: number;
    matched: string[];
  }> = [];

  for (const [docPosition, current] of scores) {
    const entry = index.docs[docPosition];
    if (!entry) continue;
    const coverage = current.matched.size / queryTokens.length;
    const score = current.score * (0.5 + 0.5 * coverage);
    parciales.push({ entry, score, matched: [...current.matched] });
  }

  const porId = (a: { entry: { doc: SearchDoc } }, b: { entry: { doc: SearchDoc } }): number =>
    a.entry.doc.id.localeCompare(b.entry.doc.id);
  parciales.sort((a, b2) => b2.score - a.score || porId(a, b2));

  // 2) Bonus por frase exacta SOLO sobre los primeros max(limit×5, 100)
  //    candidatos: plegar todos los puntuados costaba ~1 s por búsqueda y
  //    plegar el índice entero en el build, segundos de event loop.
  const top = parciales.slice(0, Math.max(limit * 5, 100)).map((parcial) => {
    const folded = foldPreservingLength(`${parcial.entry.doc.title}\n${parcial.entry.doc.body}`);
    const phraseMatch = foldedQuery.length > 3 && folded.includes(foldedQuery);
    return {
      ...parcial,
      folded,
      phraseMatch,
      score: phraseMatch ? parcial.score * 1.45 : parcial.score,
    };
  });
  top.sort((a, b2) => b2.score - a.score || porId(a, b2));

  // 3) Snippet solo para los `limit` que se devuelven (reutiliza el pliegue
  //    del paso 2, que casi siempre ya existe).
  return top.slice(0, limit).map((parcial) => ({
    id: parcial.entry.doc.id,
    kind: parcial.entry.doc.kind,
    title: parcial.entry.doc.title,
    score: Number(parcial.score.toFixed(4)),
    matchedTerms: parcial.matched,
    phraseMatch: parcial.phraseMatch,
    snippet: snippetFor(
      `${parcial.entry.doc.title}\n${parcial.entry.doc.body}`,
      queryTokens,
      parcial.folded,
    ),
    meta: parcial.entry.doc.meta,
  }));
}
