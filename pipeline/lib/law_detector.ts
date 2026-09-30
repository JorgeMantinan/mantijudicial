import { parseArticleNumbers } from "./citations.js";
import { foldPreservingLength } from "./search.js";
import { CHECKABLE_SIGLAS, siglaOfNorma, type SiglaEntry } from "./siglas.js";

export interface DetectedCitation {
  sigla: string;
  boe_id: string;
  article: number | null;
  raw: string;
}

const ARTICLE_START = /art(?:[íi]culo)?s?\.?\s*(\d[\d.,]*)/gi;
const NEXT_ARTICLE = /art(?:[íi]culo)?s?\.?\s*\d/i;

function snippet(text: string, index: number, length = 120): string {
  const start = Math.max(0, index - 20);
  return text.slice(start, start + length).replace(/\s+/g, " ").trim();
}

function locateName(foldedWindow: string, entry: SiglaEntry): number {
  let best = -1;
  const abbrev = new RegExp(`(?<![\\w/])${entry.sigla}(?![\\w/])`, "i");
  const match = abbrev.exec(foldedWindow);
  if (match) best = match.index;
  for (const name of entry.names) {
    const index = foldedWindow.indexOf(name);
    if (index >= 0 && (best < 0 || index < best)) best = index;
  }
  return best;
}

/**
 * Detector determinista de citas de normas en el texto de la sentencia: cubre
 * los huecos de la extracción con IA usando la misma regla que la evaluación,
 * aquí como fuente de citas y no solo de contraste.
 */
export function detectLawCitations(text: string): DetectedCitation[] {
  const found = new Map<string, DetectedCitation>();
  const add = (item: DetectedCitation) => {
    const key = `${item.sigla}#${item.article ?? ""}`;
    if (!found.has(key)) found.set(key, item);
  };

  for (const entry of CHECKABLE_SIGLAS) {
    ARTICLE_START.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ARTICLE_START.exec(text)) !== null) {
      // la referencia no puede saltarse al siguiente artículo: si no, "art. 477
      // LEC y al art. 24 CE" atribuiría el 477 a la Constitución.
      const after = match.index + match[0].length;
      const next = NEXT_ARTICLE.exec(text.slice(after, match.index + 160));
      const windowEnd = next ? after + next.index : match.index + 160;
      const window = text.slice(match.index, windowEnd);
      const nameIndex = locateName(foldPreservingLength(window), entry);
      if (nameIndex < 0 || nameIndex > 80) continue;
      const chunk = window.slice(0, nameIndex);
      for (const number of parseArticleNumbers(chunk)) {
        add({
          sigla: entry.sigla,
          boe_id: entry.boe_id,
          article: number,
          raw: snippet(text, match.index),
        });
      }
    }
  }

  for (const entry of CHECKABLE_SIGLAS) {
    const hasArticle = [...found.values()].some((item) => item.sigla === entry.sigla);
    if (hasArticle) continue;
    const match = entry.pattern.exec(text);
    if (!match) continue;
    add({
      sigla: entry.sigla,
      boe_id: entry.boe_id,
      article: null,
      raw: snippet(text, match.index),
    });
  }

  return [...found.values()];
}

export function existingKeys(citations: Array<{ norma?: string; article?: string }>): Set<string> {
  const keys = new Set<string>();
  for (const citation of citations) {
    const sigla = siglaOfNorma(citation.norma ?? "");
    if (!sigla) continue;
    const articles = citation.article ? parseArticleNumbers(citation.article) : [];
    if (articles.length === 0) keys.add(`${sigla}#`);
    for (const article of articles) keys.add(`${sigla}#${article}`);
  }
  return keys;
}

export function missingCitations(
  text: string,
  citations: Array<{ norma?: string; article?: string }>,
): DetectedCitation[] {
  const existing = existingKeys(citations);
  return detectLawCitations(text).filter((item) => {
    const key = `${item.sigla}#${item.article ?? ""}`;
    if (existing.has(key)) return false;
    if (item.article === null) {
      return ![...existing].some(
        (value) => value.startsWith(`${item.sigla}#`) && value !== `${item.sigla}#`,
      );
    }
    return true;
  });
}
