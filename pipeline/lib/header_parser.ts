export type HeaderFieldName =
  | "id_cendoj"
  | "court"
  | "seat"
  | "section"
  | "resolution_date"
  | "appeal_number"
  | "resolution_number"
  | "procedure_type"
  | "rapporteur"
  | "procedencia"
  | "date_vote_and_fall";

const PATTERNS: Array<{ field: HeaderFieldName; re: RegExp; last?: boolean; date?: boolean }> = [
  { field: "id_cendoj", re: /^Id Cendoj:\s*(\S+)\s*$/m },
  { field: "court", re: /^Órgano:\s*(.+)$/m },
  { field: "seat", re: /^Sede:\s*(.+)$/m },
  { field: "section", re: /^Sección:\s*(.+)$/m },
  { field: "resolution_date", re: /^Fecha:\s*(\d{2}\/\d{2}\/\d{4})/m, date: true },
  { field: "appeal_number", re: /^Nº de Recurso:\s*(.+)$/m },
  { field: "resolution_number", re: /^Nº de Resolución:\s*(.+)$/m },
  { field: "procedure_type", re: /^Procedimiento:\s*(.+)$/m },
  { field: "rapporteur", re: /^Ponente:\s*(.+)$/gm, last: true },
  { field: "procedencia", re: /^Procedencia:\s*(.+)$/m },
  { field: "date_vote_and_fall", re: /^Fecha de Votación y Fallo:\s*(\d{2}\/\d{2}\/\d{4})/m, date: true },
];

const RAPPORTeur_PREFIXES = [
  "Excmo. Sr. D. ",
  "Excmo. Sr. Dña. ",
  "Ilmo. Sr. D. ",
  "Ilma. Sra. Dña. ",
  "Ilmo. Sr. Dña. ",
  "Excmo. Sr. D",
];

export function toIsoDate(ddMmYyyy: string): string | null {
  const match = ddMmYyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function allMatches(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    const value = match[1];
    if (value !== undefined) out.push(value);
  }
  return out;
}

export function parseCaseHeader(text: string): Partial<Record<HeaderFieldName, string>> {
  const result: Partial<Record<HeaderFieldName, string>> = {};

  for (const pattern of PATTERNS) {
    if (pattern.last) {
      const matches = allMatches(text, pattern.re);
      const raw = matches[matches.length - 1];
      if (!raw) continue;
      let value = clean(raw);
      for (const prefix of RAPPORTeur_PREFIXES) {
        if (value.startsWith(prefix)) {
          value = value.slice(prefix.length).trim();
          break;
        }
      }
      result[pattern.field] = value;
      continue;
    }
    const match = text.match(pattern.re);
    const raw = match?.[1];
    if (!raw) continue;
    if (pattern.date) {
      const iso = toIsoDate(raw.trim());
      if (iso) result[pattern.field] = iso;
      continue;
    }
    result[pattern.field] = clean(raw);
  }

  return result;
}
