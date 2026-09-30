export interface SentenciaCitada {
  raw: string;
  numero: string;
  anio: string;
  tipo: "STS" | "ATS" | "SENTENCIA";
  roj: string;
  enCorpus: boolean;
  caseId: string | null;
  ecli: string | null;
}

interface Pattern {
  re: RegExp;
  tipo: "STS" | "ATS" | "SENTENCIA";
  take: (match: RegExpExecArray) => { numero: string; anio: string };
}

const PATTERNS: Pattern[] = [
  {
    re: /\b(SSTS|STS)\s+(\d{1,5})\/(\d{4})/g,
    tipo: "STS",
    take: (match) => ({ numero: match[2]!, anio: match[3]! }),
  },
  {
    re: /\bATS\s+(\d{1,5})\/(\d{4})/g,
    tipo: "ATS",
    take: (match) => ({ numero: match[1]!, anio: match[2]! }),
  },
  {
    re: /\bsentencia\s+(?:n[úu]m(?:ero)?\.?\s*)?(\d{1,5})\/(\d{4})/gi,
    tipo: "SENTENCIA",
    take: (match) => ({ numero: match[1]!, anio: match[2]! }),
  },
];

export function detectCitedSentencias(
  text: string,
): Array<{ raw: string; numero: string; anio: string; tipo: Pattern["tipo"] }> {
  const found = new Map<
    string,
    { raw: string; numero: string; anio: string; tipo: Pattern["tipo"] }
  >();

  const add = (tipo: Pattern["tipo"], numero: string, anio: string, raw: string) => {
    const key = `${tipo}#${numero}/${anio}`;
    if (found.has(key)) return;
    found.set(key, { raw: raw.replace(/\s+/g, " ").trim(), numero, anio, tipo });
  };

  for (const { re, tipo, take } of PATTERNS) {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      const { numero, anio } = take(match);
      add(tipo, numero, anio, match[0]);

      // «sentencia 580/2020, de 5 de noviembre, 581/2020»: continúa la lista
      if (tipo !== "ATS") {
        const window = text.slice(match.index + match[0].length, match.index + match[0].length + 90);
        const continuation = /(?<!\d)\d{1,4}\/(\d{4})/g;
        let next: RegExpExecArray | null;
        while ((next = continuation.exec(window)) !== null) {
          const before = window.slice(Math.max(0, next.index - 12), next.index);
          if (/(?:ley|real decreto|decreto|lo|rld?|rd)\s*$/i.test(before)) continue;
          add("SENTENCIA", next[0].split("/")[0]!, next[0].split("/")[1]!, next[0]);
        }
      }
    }
  }
  return [...found.values()];
}

export interface CorpusEntry {
  caseDir: string;
  roj: string | null;
  ecli: string | null;
}

export function matchWithCorpus(text: string, corpus: CorpusEntry[]): SentenciaCitada[] {
  const byRojo = new Map<string, CorpusEntry>();
  for (const entry of corpus) {
    if (entry.roj) byRojo.set(entry.roj.replace(/\s+/g, " ").trim().toUpperCase(), entry);
  }

  return detectCitedSentencias(text).map((item) => {
    const roj =
      item.tipo === "SENTENCIA" || item.tipo === "STS"
        ? `STS ${item.numero}/${item.anio}`
        : `ATS ${item.numero}/${item.anio}`;
    const hit = byRojo.get(roj.toUpperCase());
    return {
      ...item,
      roj,
      enCorpus: Boolean(hit),
      caseId: hit?.caseDir ?? null,
      ecli: hit?.ecli ?? null,
    };
  });
}
