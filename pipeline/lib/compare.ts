import { z } from "zod";

export const COMPARE_PROMPT_VERSION = "compare-v1";

const apoyo = z.object({
  argumento: z.string(),
  apoyo_case_id: z.string().default("UNKNOWN"),
  apoyo_frase: z.string().default("UNKNOWN"),
  resultado: z.enum(["ACEPTADO", "RECHAZADO", "PARCIAL", "DESCONOCIDO"]),
});

export const compareSchema = z.object({
  case_id: z.string(),
  otro_caso: z.string(),
  aplicabilidad: z.enum(["ALTA", "MEDIA", "BAJA"]),
  similitudes: z
    .array(
      z.object({
        aspecto: z.string(),
        detalle: z.string(),
        apoyo_case_id: z.string().default("UNKNOWN"),
      }),
    )
    .default([]),
  diferencias: z
    .array(z.object({ aspecto: z.string(), detalle: z.string(), impacto: z.string() }))
    .default([]),
  argumentos_efectivos: z.array(apoyo).default([]),
  huecos: z.array(z.object({ descripcion: z.string(), como_cubrirlo: z.string() })).default([]),
  contraargumentos: z
    .array(
      z.object({
        del_contrario: z.string(),
        nuestra_respuesta: z.string(),
        apoyo_case_id: z.string().default("UNKNOWN"),
      }),
    )
    .default([]),
  riesgos: z.array(z.string()).default([]),
  conclusion: z.string(),
  avisos: z.array(z.string()).default([]),
});

export type CompareReport = z.infer<typeof compareSchema>;

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

function toObjectArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.filter(isObj);
  if (isObj(value)) return [value];
  return [];
}

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(source: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

const RESULTADO_MAP: Record<string, string> = {
  ACEPTADO: "ACEPTADO",
  ACEPTADA: "ACEPTADO",
  ESTIMADO: "ACEPTADO",
  ESTIMADA: "ACEPTADO",
  APROBADO: "ACEPTADO",
  RECHAZADO: "RECHAZADO",
  RECHAZADA: "RECHAZADO",
  DESESTIMADO: "RECHAZADO",
  DESESTIMADA: "RECHAZADO",
  PARCIAL: "PARCIAL",
  PARCIALMENTE: "PARCIAL",
  DESCONOCIDO: "DESCONOCIDO",
  UNKNOWN: "DESCONOCIDO",
};

function coerceResultado(value: unknown): string {
  if (typeof value !== "string") return "DESCONOCIDO";
  const up = value.trim().toUpperCase();
  if (["ACEPTADO", "RECHAZADO", "PARCIAL", "DESCONOCIDO"].includes(up)) return up;
  return RESULTADO_MAP[up] ?? "DESCONOCIDO";
}

/**
 * El modelo varía nombres de campo y tipos: aquí se normaliza a las claves
 * exactas del esquema sin perder las listas de objetos.
 */
export function normalizeCompareInput(input: unknown): unknown {
  if (!isObj(input)) return input;
  const out: Record<string, unknown> = { ...input };

  for (const key of ["riesgos", "avisos"]) {
    if (key in out) out[key] = toStringArray(out[key]);
  }
  for (const key of ["similitudes", "diferencias", "argumentos_efectivos", "huecos", "contraargumentos"]) {
    if (key in out) out[key] = toObjectArray(out[key]);
  }

  if (Array.isArray(out.similitudes)) {
    out.similitudes = out.similitudes.map((item) => {
      if (!isObj(item)) return item;
      return {
        ...item,
        aspecto: str(item, ["aspecto", "titulo", "tema", "title"]),
        detalle: str(item, ["detalle", "descripcion", "texto", "description"]),
      };
    });
  }
  if (Array.isArray(out.diferencias)) {
    out.diferencias = out.diferencias.map((item) => {
      if (!isObj(item)) return item;
      return {
        ...item,
        aspecto: str(item, ["aspecto", "titulo", "tema"]),
        detalle: str(item, ["detalle", "descripcion", "texto"]),
        impacto: str(item, ["impacto", "efecto", "consecuencia"]),
      };
    });
  }
  if (Array.isArray(out.argumentos_efectivos)) {
    out.argumentos_efectivos = out.argumentos_efectivos.map((item) => {
      if (!isObj(item)) return item;
      return {
        ...item,
        argumento: str(item, ["argumento", "descripcion", "texto", "description"]),
        resultado: coerceResultado(item.resultado ?? item.outcome),
      };
    });
  }
  if (Array.isArray(out.huecos)) {
    out.huecos = out.huecos.map((item) => {
      if (!isObj(item)) return item;
      return {
        ...item,
        descripcion: str(item, ["descripcion", "problema", "falta", "gap"]),
        como_cubrirlo: str(item, ["como_cubrirlo", "solucion", "accion"]),
      };
    });
  }
  if (Array.isArray(out.contraargumentos)) {
    out.contraargumentos = out.contraargumentos.map((item) => {
      if (!isObj(item)) return item;
      return {
        ...item,
        del_contrario: str(item, ["del_contrario", "argumento", "objecion", "titulo"]),
        nuestra_respuesta: str(item, ["nuestra_respuesta", "respuesta", "replica", "detalle"]),
      };
    });
  }

  if (typeof out.case_id !== "string") out.case_id = "";
  if (typeof out.otro_caso !== "string") out.otro_caso = "";
  if (typeof out.conclusion !== "string") out.conclusion = str(out, ["conclusion", "resumen"]);
  return out;
}

export interface CaseSignals {
  id: string;
  headline: string;
  subtopic: string;
  branch: string;
  outcome: string;
  recurringSide: string;
  summary: string;
  keyPoints: string[];
  facts: string[];
  claims: string[];
  issues: string[];
  argumentsList: string[];
  holdings: Array<{ topic: string; statement: string; doctrine: string }>;
  laws: Array<{ norma: string; article: string; boeId: string | null }>;
}

export function renderCase(signals: CaseSignals): string {
  const lines: string[] = [];
  lines.push(`### ${signals.id} — ${signals.headline}`);
  if (signals.subtopic) lines.push(`Subtema: ${signals.subtopic}`);
  lines.push(
    `Rama: ${signals.branch} | Resultado casación: ${signals.outcome} | Recurrente: ${signals.recurringSide}`,
  );
  if (signals.summary) lines.push(`\n${signals.summary}`);
  if (signals.keyPoints.length) lines.push(`- Puntos clave:\n- ${signals.keyPoints.join("\n- ")}`);
  if (signals.claims.length) lines.push(`- Pretensiones:\n- ${signals.claims.join("\n- ")}`);
  if (signals.facts.length) lines.push(`- Hechos:\n- ${signals.facts.slice(0, 12).join("\n- ")}`);
  if (signals.issues.length) lines.push(`- Cuestiones:\n- ${signals.issues.join("\n- ")}`);
  if (signals.argumentsList.length) {
    lines.push(`- Argumentos:\n- ${signals.argumentsList.slice(0, 14).join("\n- ")}`);
  }
  if (signals.holdings.length) {
    lines.push("- Frases del tribunal:");
    for (const holding of signals.holdings.slice(0, 8)) {
      lines.push(`  · [${holding.topic}] ${holding.statement} (doctrina: ${holding.doctrine})`);
    }
  }
  if (signals.laws.length) {
    lines.push(
      `- Normas citadas: ${signals.laws
        .map((law) => `${law.norma}${law.article ? ` ${law.article}` : ""}${law.boeId ? ` (${law.boeId})` : ""}`)
        .join(" | ")}`,
    );
  }
  return lines.join("\n");
}

export function renderCompareContext(primary: CaseSignals, other: CaseSignals): string {
  return [
    `## CASO PRINCIPAL (${primary.id})`,
    renderCase(primary),
    "",
    `## CASO DE REFERENCIA (${other.id})`,
    renderCase(other),
    "",
    "## INSTRUCCIONES",
    "Compara los dos casos para decir al abogado qué puede trasladarse de uno a otro,",
    "qué le falta al caso principal y qué contraargumentos puede esperar la parte contraria.",
    "NO inventes casos, frases ni números de recurso: usa solo lo anterior.",
  ].join("\n");
}

export function buildComparePrompt(primaryId: string, otherId: string): string {
  return `Eres un abogado litigante senior experto en Derecho civil y procesal civil espanol. Compara dos casos del corpus (${primaryId} como principal y ${otherId} como referencia) y devuelve UN SOLO objeto JSON valido.

CLAVES (exactas): case_id, otro_caso, aplicabilidad (ALTA|MEDIA|BAJA), similitudes[], diferencias[], argumentos_efectivos[], huecos[], contraargumentos[], riesgos[], conclusion, avisos[].

- similitudes[]: {aspecto, detalle, apoyo_case_id}
- diferencias[]: {aspecto, detalle, impacto}
- argumentos_efectivos[]: {argumento, apoyo_case_id, apoyo_frase, resultado (ACEPTADO|RECHAZADO|PARCIAL|DESCONOCIDO)}
- huecos[] = informacion que falta en el caso principal: {descripcion, como_cubrirlo}
- contraargumentos[]: {del_contrario, nuestra_respuesta, apoyo_case_id}
- conclusion: 3 a 6 frases con el plan recomendado.
- avisos: incluye siempre que esto es asistencia analitica y el abogado debe verificar doctrina vigente y textos oficiales.

Sin markdown, sin comentarios, sin texto fuera del JSON.`;
}
