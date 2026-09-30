import { z } from "zod";
import { type CaseSignals, renderCase } from "./compare.js";

export const ESCRITO_PROMPT_VERSION = "escrito-v1";

export const escritoSchema = z.object({
  case_id: z.string(),
  tipo: z.enum(["RECURSO_CASACION", "ALEGACIONES", "OPOSICION"]),
  asunto: z.string(),
  encabezado: z
    .object({
      tribunal: z.string().default(""),
      numero_recurso: z.string().default(""),
      procurador: z.string().default(""),
      letrado: z.string().default(""),
    })
    .default({ tribunal: "", numero_recurso: "", procurador: "", letrado: "" }),
  cuerpo: z.array(z.object({ titulo: z.string(), texto: z.string() })).min(1),
  pedidos: z.array(z.string()).default([]),
  citas: z.array(z.object({ texto: z.string(), fuente: z.string() })).default([]),
  comprobar_antes: z.array(z.string()).default([]),
  avisos: z.array(z.string()).default([]),
});

export type EscritoReport = z.infer<typeof escritoSchema>;

function isObj(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function str(source: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

/** Normaliza las variantes del modelo a las claves exactas del esquema. */
export function normalizeEscritoInput(input: unknown): unknown {
  if (!isObj(input)) return input;
  const out: Record<string, unknown> = { ...input };

  if ("cuerpo" in out) {
    out.cuerpo = toObjectArray(out.cuerpo).map((item) => ({
      ...item,
      titulo: str(item, ["titulo", "heading", "seccion"]),
      texto: str(item, ["texto", "contenido", "content", "parrafo"]),
    }));
  }
  if ("pedidos" in out) out.pedidos = toStringArray(out.pedidos);
  if ("comprobar_antes" in out) out.comprobar_antes = toStringArray(out.comprobar_antes);
  if ("avisos" in out) out.avisos = toStringArray(out.avisos);

  if ("citas" in out) {
    out.citas = toObjectArray(out.citas).map((item) => ({
      ...item,
      texto: str(item, ["texto", "cita", "quote"]),
      fuente: str(item, ["fuente", "source", "norma", "caso"]),
    }));
  }

  if (isObj(out.encabezado)) {
    out.encabezado = {
      tribunal: str(out.encabezado, ["tribunal", "organo"]),
      numero_recurso: str(out.encabezado, ["numero_recurso", "recurso", "numero"]),
      procurador: str(out.encabezado, ["procurador"]),
      letrado: str(out.encabezado, ["letrado", "abogado"]),
    };
  }

  if (typeof out.tipo !== "string") out.tipo = "RECURSO_CASACION";
  if (typeof out.asunto !== "string") out.asunto = str(out, ["asunto", "titulo"], "");
  if (typeof out.case_id !== "string") out.case_id = "";
  return out;
}

export interface EscritoContext {
  principal: CaseSignals;
  similares: CaseSignals[];
  leyes: Array<{
    sigla: string;
    boe_id: string;
    titulo: string;
    articulos: Array<{ titulo: string; texto: string }>;
  }>;
}

export function renderEscritoContext(context: EscritoContext): string {
  const parts: string[] = [];
  parts.push("## DATOS DEL CASO (fuente unica de la verdad)");
  parts.push(renderCase(context.principal));

  if (context.leyes.length > 0) {
    parts.push("\n## NORMAS VERIFICADAS (cita solo estas, con texto literal)");
    for (const law of context.leyes) {
      parts.push(`\n### ${law.sigla} (${law.boe_id}) - ${law.titulo}`);
      for (const article of law.articulos.slice(0, 4)) {
        parts.push(`- [${article.titulo}] ${article.texto.replace(/\s+/g, " ").slice(0, 800)}`);
      }
    }
  }

  if (context.similares.length > 0) {
    parts.push("\n## CASOS SIMILARES CON ARGUMENTOS ACEPTADOS");
    for (const item of context.similares) {
      parts.push(`\n- ${item.id} (${item.outcome}): ${item.headline}`);
      const aceptados = item.argumentsList.filter((argument) => argument.includes("ACEPTADO"));
      for (const argument of aceptados.slice(0, 4)) parts.push(`    - ${argument}`);
    }
  }

  parts.push(
    [
      "",
      "## REGLAS",
      "1. Un solo objeto JSON, sin markdown ni texto fuera de el.",
      "2. No inventes hechos, fechas, numeros de recurso ni sentencias: si no esta en los datos, va en comprobar_antes.",
      "3. Las citas salen solo de NORMAS VERIFICADAS, con texto literal y su fuente.",
      "4. Estilo procesal espanol de escrito presentado al Tribunal Supremo.",
      "5. En avisos, incluye siempre que es un borrador asistido por IA pendiente de revision por un letrado.",
    ].join("\n"),
  );
  return parts.join("\n");
}

export function buildEscritoPrompt(caseId: string, tipo: string): string {
  return `Eres un letrado senior del Tribunal Supremo. Redacta un BORRADOR de escrito de tipo ${tipo} para el caso ${caseId}, usando EXCLUSIVAMENTE los datos del contexto adjunto.

Devuelve UN SOLO objeto JSON valido con exactamente estas claves:
case_id, tipo ("${tipo}"), asunto, encabezado{tribunal,numero_recurso,procurador,letrado}, cuerpo[{titulo,texto}], pedidos[], citas[{texto,fuente}], comprobar_antes[], avisos[].

- cuerpo: entre 4 y 8 bloques (p. ej. HECHOS, ANTECEDENTES, FUNDAMENTOS DE DERECHO, PRUEBA, SUPLICA).
- pedidos: peticiones concretas numeradas.
- citas: solo textos que aparezcan literalmente en NORMAS VERIFICADAS, con su fuente (art. X LEC o BOE-A-...).
- comprobar_antes: todo dato que falte o deba confirmar el letrado (fechas, numeros, representacion...).
- avisos: incluye siempre que es un borrador asistido por IA pendiente de revision profesional.

Sin markdown, sin comentarios, sin texto fuera del JSON.`;
}