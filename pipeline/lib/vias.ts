import { z } from "zod";

export const VIAS_PROMPT_VERSION = "vias-v1";

export const viasSchema = z.object({
  case_id: z.string(),
  vias: z
    .array(
      z.object({
        id: z.string(),
        titulo: z.string(),
        estrategia: z.string(),
        fuerza: z.enum(["ALTA", "MEDIA", "BAJA"]),
        argumentos: z
          .array(
            z.object({
              argumento: z.string(),
              apoyo_case_id: z.string().default("UNKNOWN"),
              apoyo_frase: z.string().default("UNKNOWN"),
              ley: z.string().default("UNKNOWN"),
            }),
          )
          .default([]),
        evidencia_a_solicitar: z.array(z.string()).default([]),
        riesgos: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  huecos: z
    .array(z.object({ descripcion: z.string(), como_cubrirlo: z.string() }))
    .default([]),
  consultas_al_cliente: z.array(z.string()).default([]),
  leyes_relevantes: z
    .array(z.object({ boe_id: z.string(), article: z.string(), por_que: z.string() }))
    .default([]),
  avisos: z.array(z.string()).default([]),
});

export type ViasReport = z.infer<typeof viasSchema>;

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function coerceFuerza(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const up = value.trim().toUpperCase();
  if (up === "ALTA" || up === "MEDIA" || up === "BAJA") return up;
  if (up.includes("MUY") || up.includes("ALTA")) return "ALTA";
  if (up.includes("BAJA")) return "BAJA";
  if (up.includes("MEDIA")) return "MEDIA";
  return value;
}

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

/**
 * El modelo varía nombres de campo y tipos según el caso; aquí se normalizan
 * a las claves exactas del esquema antes de validar.
 */
export function normalizeViasInput(input: unknown): unknown {
  if (!isObj(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (typeof out.case_id !== "string") out.case_id = "";

  if (Array.isArray(out.vias)) {
    out.vias = out.vias.map((raw, position) => {
      if (!isObj(raw)) return raw;
      const via: Record<string, unknown> = { ...raw };
      if (typeof via.id !== "string" || via.id.length === 0) {
        via.id = `VIA-${String(position + 1).padStart(3, "0")}`;
      }
      via.fuerza = coerceFuerza(via.fuerza);
      if (typeof via.titulo !== "string") via.titulo = pickString(via, ["titulo", "name", "nombre"]) ?? "";
      if (typeof via.estrategia !== "string") {
        via.estrategia = pickString(via, ["estrategia", "descripcion", "description", "plan"]) ?? "";
      }
      if ("riesgos" in via) via.riesgos = toArray(via.riesgos);
      if ("evidencia_a_solicitar" in via || "evidencia" in via) {
        via.evidencia_a_solicitar = toArray(via.evidencia_a_solicitar ?? via.evidencia);
      }
      if (Array.isArray(via.argumentos)) {
        via.argumentos = via.argumentos.map((rawArg) => {
          if (!isObj(rawArg)) return rawArg;
          const argument: Record<string, unknown> = { ...rawArg };
          if (typeof argument.argumento !== "string") {
            const alt = pickString(argument, ["argumento", "descripcion", "texto", "argument", "description"]);
            if (alt) argument.argumento = alt;
          }
          if (typeof argument.argumento !== "string") argument.argumento = "";
          if (typeof argument.apoyo_case_id !== "string") argument.apoyo_case_id = "UNKNOWN";
          if (typeof argument.apoyo_frase !== "string") argument.apoyo_frase = "UNKNOWN";
          if (typeof argument.ley !== "string") argument.ley = "UNKNOWN";
          return argument;
        });
      }
      return via;
    });
  }

  if (Array.isArray(out.huecos)) {
    out.huecos = out.huecos.map((raw) => {
      if (typeof raw === "string") return { descripcion: raw, como_cubrirlo: "" };
      if (!isObj(raw)) return raw;
      const hueco: Record<string, unknown> = { ...raw };
      if (typeof hueco.descripcion !== "string") {
        hueco.descripcion = pickString(hueco, ["descripcion", "problema", "gap"]) ?? "";
      }
      if (typeof hueco.como_cubrirlo !== "string") {
        hueco.como_cubrirlo = pickString(hueco, ["como_cubrirlo", "solucion", "accion"]) ?? "";
      }
      return hueco;
    });
  }

  if (Array.isArray(out.leyes_relevantes)) {
    out.leyes_relevantes = out.leyes_relevantes.map((raw) => {
      if (!isObj(raw)) return raw;
      const law: Record<string, unknown> = { ...raw };
      if (typeof law.boe_id !== "string") law.boe_id = pickString(law, ["boe_id", "norma", "id"]) ?? "";
      if (typeof law.article !== "string") law.article = pickString(law, ["article", "articulo"]) ?? "";
      if (typeof law.por_que !== "string") law.por_que = pickString(law, ["por_que", "motivo", "razon"]) ?? "";
      return law;
    });
  }

  if ("consultas_al_cliente" in out || "consultas" in out) {
    out.consultas_al_cliente = toArray(out.consultas_al_cliente ?? out.consultas);
  }
  if ("avisos" in out) out.avisos = toArray(out.avisos);
  return out;
}


export interface SimilarCaseContext {
  id: string;
  headline: string;
  branch: string;
  outcome: string;
  subtopic: string;
  holdings: Array<{ topic: string; statement: string; doctrine: string }>;
  argumentsList: Array<{ side: string; type: string; outcome: string; description: string }>;
  verifiedLaws: string[];
}

export interface LawContext {
  boe_id: string;
  sigla: string;
  titulo: string;
  articles: Array<{ number: number; titulo: string; texto: string }>;
}

export interface ViasContext {
  caseId: string;
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
  ownArguments: string[];
  similar: SimilarCaseContext[];
  laws: LawContext[];
}

function block(title: string, lines: string[]): string {
  const body = lines.filter((line) => line && line.trim().length > 0).join("\n- ");
  return `### ${title}\n- ${body || "n/d"}`;
}

export function renderViasContext(context: ViasContext): string {
  const parts: string[] = [];

  parts.push(`## CASO EN ANALISIS: ${context.caseId}`);
  parts.push(`Asunto: ${context.headline}`);
  if (context.subtopic) parts.push(`Subtema: ${context.subtopic}`);
  parts.push(`Rama: ${context.branch} | Resultado en casacion: ${context.outcome} | Recurrente: ${context.recurringSide}`);
  if (context.summary) parts.push(`\n${context.summary}`);
  parts.push(block("Puntos clave", context.keyPoints));
  parts.push(block("Hechos", context.facts));
  parts.push(block("Pretensiones", context.claims));
  parts.push(block("Cuestiones planteadas", context.issues));
  parts.push(block("Argumentos ya formulados en el caso", context.ownArguments));

  parts.push(`\n## CASOS SIMILARES DEL CORPUS (${context.similar.length})`);
  if (context.similar.length === 0) parts.push("(sin casos similares)");
  for (const item of context.similar) {
    parts.push(
      `\n--- ${item.id} | ${item.branch} | resultado=${item.outcome}\nAsunto: ${item.headline}`,
    );
    if (item.subtopic) parts.push(`Subtema: ${item.subtopic}`);
    if (item.holdings.length > 0) {
      parts.push("Frases del tribunal:");
      for (const holding of item.holdings.slice(0, 6)) {
        parts.push(`  · [${holding.topic}] ${holding.statement} (doctrina: ${holding.doctrine})`);
      }
    }
    const accepted = item.argumentsList.filter((argument) => argument.outcome === "ACCEPTED");
    if (accepted.length > 0) {
      parts.push("Argumentos aceptados:");
      for (const argument of accepted.slice(0, 6)) {
        parts.push(`  · [${argument.side}/${argument.type}] ${argument.description}`);
      }
    }
    if (item.verifiedLaws.length > 0) parts.push(`Normas citadas verificadas: ${item.verifiedLaws.join(", ")}`);
  }

  parts.push(`\n## NORMAS VERIFICADAS (${context.laws.length})`);
  if (context.laws.length === 0) parts.push("(sin normas verificadas)");
  for (const law of context.laws) {
    parts.push(`\n--- ${law.sigla} (${law.boe_id}): ${law.titulo}`);
    for (const article of law.articles.slice(0, 4)) {
      const text = article.texto.replace(/\s+/g, " ").slice(0, 900);
      parts.push(`  [${article.titulo || `art. ${article.number}`}] ${text}`);
    }
  }

  return parts.join("\n");
}

export function buildViasPrompt(caseId: string): string {
  return `Eres un abogado litigante senior experto en Derecho civil y procesal civil espanol. Trabajas para el equipo que defiende el caso ${caseId}. Tu tarea es proponer VIAS DE ACTUACION para intentar ganar (o mejorar la posicion de) ese caso, apoyandote unicamente en el corpus que se te adjunta.

REGLAS OBLIGATORIAS:
1. Devuelve UN SOLO objeto JSON valido. Sin markdown, sin comentarios, sin texto fuera del JSON.
2. Claves exactas: case_id, vias, huecos, consultas_al_cliente, leyes_relevantes, avisos.
3. "vias": entre 2 y 5 entradas. Cada una con id (VIA-001...), titulo corto, estrategia (2-4 frases), fuerza (ALTA|MEDIA|BAJA), argumentos, evidencia_a_solicitar, riesgos.
4. Cada argumento debe llevar apoyo_case_id (un case id REAL del corpus adjunto o "UNKNOWN") y apoyo_frase (cita textual o resumen breve de la frase del tribunal que lo respalda, o "UNKNOWN"). NO inventes casos, frases, sentencias ni numeros de recurso: si no esta en el corpus, usa "UNKNOWN".
5. "leyes_relevantes" solo puede citar boe_id y articulos que aparezcan en la seccion NORMAS VERIFICADAS.
6. "huecos" = informacion que falta en el expediente para sostener cada via. "consultas_al_cliente" = preguntas concretas que deberia hacerse el abogado.
7. "avisos" debe incluir siempre una linea recordando que esto es asistencia analitica y que el abogado debe verificar doctrina vigente y textos legales oficiales antes de usarlo.
8. Si el corpus no permite sostener una via, dilo en "avisos" en vez de inventar.

ESQUELETO EXACTO DEL JSON (respeta claves y tipos; "riesgos" y "argumentos" son arrays):
{"case_id":"${caseId}","vias":[{"id":"VIA-001","titulo":"titulo corto","estrategia":"2 a 4 frases","fuerza":"ALTA","argumentos":[{"argumento":"el argumento","apoyo_case_id":"case_000000","apoyo_frase":"cita breve","ley":"art. 1124 CC"}],"evidencia_a_solicitar":["documento"],"riesgos":["riesgo"]}],"huecos":[{"descripcion":"falta","como_cubrirlo":"como obtenerlo"}],"consultas_al_cliente":["pregunta"],"leyes_relevantes":[{"boe_id":"BOE-A-1889-4763","article":"1124","por_que":"por que importa"}],"avisos":["nota"]}

El JSON debe ser validable con el esquema del proyecto (campos obligatorios: case_id y al menos una via con id, titulo, estrategia y fuerza).`;
}
