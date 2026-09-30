export interface ExtractionQuality {
  pages: number;
  chars: number;
  charsPerPage: number;
  hasText: boolean;
  reason: string | null;
}

const MIN_CHARS_PER_PAGE = 100;

/**
 * Un PDF escaneado (imagen) no aporta texto: detectarlo ahorra una llamada de IA
 * sobre un documento vacío y avisa de que hace falta OCR.
 */
export function assessExtraction(pages: Array<{ lines: string[] }>): ExtractionQuality {
  const pageCount = pages.length;
  const chars = pages.reduce((sum, page) => sum + page.lines.join("\n").length, 0);
  const charsPerPage = pageCount > 0 ? Math.round(chars / pageCount) : 0;

  if (pageCount === 0) {
    return { pages: 0, chars: 0, charsPerPage: 0, hasText: false, reason: "sin páginas" };
  }
  if (charsPerPage < MIN_CHARS_PER_PAGE) {
    return {
      pages: pageCount,
      chars,
      charsPerPage,
      hasText: false,
      reason: `solo ${charsPerPage} caracteres por página: probable PDF escaneado (hace falta OCR)`,
    };
  }
  return { pages: pageCount, chars, charsPerPage, hasText: true, reason: null };
}
