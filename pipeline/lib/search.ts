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
  docs: Array<{ doc: SearchDoc; length: number; folded: string }>;
  postings: Map<string, Array<{ doc: number; tf: number }>>;
  docFreq: Map<string, number>;
  totalLength: number;
}

export function foldPreservingLength(text: string): string {
  let out = "";
  for (const char of text) {
    const decomposed = char.normalize("NFD");
    const base = decomposed.replace(/[\u0300-\u036f]/g, "");
    out += base.length === 1 ? base.toLowerCase() : char.toLowerCase();
  }
  return out;
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
  const indexed: Array<{ doc: SearchDoc; length: number; folded: string }> = [];
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
    indexed.push({ doc, length: tokens.length, folded: foldPreservingLength(`${doc.title}\n${doc.body}`) });
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

function snippetFor(text: string, terms: string[]): string {
  const folded = foldPreservingLength(text);
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

  const hits: SearchHit[] = [];
  for (const [docPosition, current] of scores) {
    const entry = index.docs[docPosition];
    if (!entry) continue;
    const coverage = current.matched.size / queryTokens.length;
    const phraseMatch = foldedQuery.length > 3 && entry.folded.includes(foldedQuery);
    let score = current.score * (0.5 + 0.5 * coverage);
    if (phraseMatch) score *= 1.45;
    hits.push({
      id: entry.doc.id,
      kind: entry.doc.kind,
      title: entry.doc.title,
      score: Number(score.toFixed(4)),
      matchedTerms: [...current.matched],
      phraseMatch,
      snippet: snippetFor(`${entry.doc.title}\n${entry.doc.body}`, queryTokens),
      meta: entry.doc.meta,
    });
  }

  hits.sort((a, b2) => b2.score - a.score || a.id.localeCompare(b2.id));
  return hits.slice(0, limit);
}
