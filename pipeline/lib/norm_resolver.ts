export interface CatalogNorm {
  fecha_actualizacion: string;
  identificador: string;
  ambito: { codigo: string; texto: string };
  rango: { codigo: string; texto: string };
  numero_oficial: string;
  titulo: string;
  fecha_publicacion: string;
  fecha_vigencia: string;
  vigencia_agotada: string;
  estado_consolidacion?: { codigo: string; texto: string };
  url_html_consolidada: string;
}

export interface NormTarget {
  key: string;
  pattern: string;
  require?: string;
  known?: string;
}

export function normalizeTitle(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REFORM_WORDS = ["reforma", "modificaci", "se modifican", "se modifica", "adaptaci"];

export function resolveNorm(target: NormTarget, norms: CatalogNorm[]): CatalogNorm | null {
  if (target.known) {
    const known = norms.find((norm) => norm.identificador === target.known);
    if (known) return known;
  }
  const pattern = normalizeTitle(target.pattern);
  const required = target.require ? normalizeTitle(target.require) : null;
  const matches = norms.filter((norm) => {
    const title = normalizeTitle(norm.titulo);
    if (!title.includes(pattern)) return false;
    if (required && !title.includes(required)) return false;
    return true;
  });
  if (matches.length === 0) return null;
  const isReform = (norm: CatalogNorm): number => {
    const title = normalizeTitle(norm.titulo);
    return REFORM_WORDS.some((word) => title.includes(word)) ? 1 : 0;
  };
  matches.sort((a, b) => {
    const aOk = a.vigencia_agotada === "N" ? 0 : 1;
    const bOk = b.vigencia_agotada === "N" ? 0 : 1;
    if (aOk !== bOk) return aOk - bOk;
    const aEstatal = a.ambito.codigo === "1" ? 0 : 1;
    const bEstatal = b.ambito.codigo === "1" ? 0 : 1;
    if (aEstatal !== bEstatal) return aEstatal - bEstatal;
    const aReform = isReform(a);
    const bReform = isReform(b);
    if (aReform !== bReform) return aReform - bReform;
    return a.titulo.length - b.titulo.length;
  });
  return matches[0] ?? null;
}
