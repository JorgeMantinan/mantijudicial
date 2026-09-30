function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function stripTernaries(text: string): string {
  return text.replace(
    /"([A-Za-z0-9_]+)":"[^"]*"\s*===\s*"[^"]*"\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/g,
    (_m, key: string, whenTrue: string) => `"${key}":"${whenTrue}"`,
  );
}

function repairJson(text: string): string {
  return text
    .replace(/\{"page":(\d+)\]\}/g, '{"page":$1}')
    .replace(/(\d)"\}/g, "$1}");
}

function nextNonSpace(text: string, from: number): string | undefined {
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== " " && ch !== "\n" && ch !== "\r" && ch && ch !== "\t") return ch;
  }
  return undefined;
}

function readString(text: string, start: number): number {
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === '"') return i + 1;
    i += 1;
  }
  return -1;
}

/**
 * Repara errores estructurales típicos del modelo sin tocar el contenido:
 * - `]` donde faltaba `}` (o al revés): inserta el cierre que falta.
 * - Objeto cerrado prematuramente seguido de `,` clave: lo reabre.
 * - Basura final tras el primer objeto completo: la descarta.
 */
export function tolerantScan(input: string): string {
  const out: string[] = [];
  const stack: string[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i]!;
    if (ch === '"') {
      const end = readString(input, i);
      if (end < 0) {
        out.push(input.slice(i), '"');
        break;
      }
      out.push(input.slice(i, end));
      i = end;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(ch);
      out.push(ch);
      i += 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (stack.length === 0) {
        if (nextNonSpace(input, i + 1) === ",") {
          i += 1;
          continue;
        }
        break;
      }
      const top = stack[stack.length - 1]!;
      const wanted = top === "{" ? "}" : "]";
      if (ch === wanted) {
        const empties = stack.length === 1;
        if (empties && nextNonSpace(input, i + 1) === ",") {
          i += 1;
          continue;
        }
        out.push(ch);
        stack.pop();
        i += 1;
        continue;
      }
      out.push(wanted);
      stack.pop();
      continue;
    }
    out.push(ch);
    i += 1;
  }

  while (stack.length > 0) {
    const top = stack.pop()!;
    out.push(top === "{" ? "}" : "]");
  }
  return out.join("");
}

function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      const end = readString(text, i);
      if (end < 0) return -1;
      i = end - 1;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function parseFirstObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return undefined;
  const end = findBalancedEnd(text, start);
  if (end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function extractJson(raw: string): unknown {
  const base = stripFences(raw);
  const repaired = repairJson(base);
  const variants = [
    base,
    stripTernaries(base),
    repaired,
    stripTernaries(repaired),
    tolerantScan(base),
    tolerantScan(repaired),
    tolerantScan(stripTernaries(repaired)),
  ];
  for (const candidate of variants) {
    const parsed = tryParse(candidate);
    if (parsed !== undefined) return parsed;
  }
  for (const candidate of variants) {
    const parsed = parseFirstObject(candidate);
    if (parsed !== undefined) return parsed;
  }
  throw new Error("La respuesta del modelo no contiene JSON valido");
}
