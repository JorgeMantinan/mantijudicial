import { describe, expect, it } from "vitest";
import {
  buildEscritoPrompt,
  escritoSchema,
  normalizeEscritoInput,
  renderEscritoContext,
  type EscritoContext,
} from "./escrito.js";
import type { CaseSignals } from "./compare.js";

function signals(overrides: Partial<CaseSignals>): CaseSignals {
  return {
    id: "case_000034",
    headline: "Nulidad de cláusula suelo",
    subtopic: "clausulas abusivas",
    branch: "CONTRACTUAL",
    outcome: "ESTIMED",
    recurringSide: "CONSUMER",
    summary: "Resumen del caso.",
    keyPoints: ["clave"],
    facts: ["hecho"],
    claims: ["pretensión de nulidad"],
    issues: ["cuestión: validez"],
    argumentsList: ["[CONSUMER/LEGAL · ACEPTADO] argumento aceptado", "[BANK/LEGAL · RECHAZADO] otro"],
    holdings: [{ topic: "buena fe", statement: "Frase.", doctrine: "STS 1/2020" }],
    laws: [{ norma: "CC", article: "1255", boeId: "BOE-A-1889-4763" }],
    ...overrides,
  };
}

const context: EscritoContext = {
  principal: signals({}),
  similares: [signals({ id: "case_000045", headline: "Otro caso", outcome: "DISMISSED" })],
  leyes: [
    {
      sigla: "LEC",
      boe_id: "BOE-A-2000-323",
      titulo: "Ley de Enjuiciamiento Civil",
      articulos: [{ titulo: "Artículo 458.1", texto: "El recurso de casación procederá." }],
    },
  ],
};

describe("escritoSchema", () => {
  it("acepta un borrador mínimo y rellena listas", () => {
    const parsed = escritoSchema.safeParse({
      case_id: "case_000034",
      tipo: "RECURSO_CASACION",
      asunto: "Casación 6484/2023",
      cuerpo: [{ titulo: "HECHOS", texto: "Texto." }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.pedidos).toEqual([]);
      expect(parsed.data.encabezado.procurador).toBe("");
    }
  });

  it("rechaza tipo desconocido y cuerpo vacío", () => {
    expect(
      escritoSchema.safeParse({
        case_id: "a",
        tipo: "RECURSO_LIBRE",
        asunto: "x",
        cuerpo: [{ titulo: "t", texto: "b" }],
      }).success,
    ).toBe(false);
    expect(
      escritoSchema.safeParse({ case_id: "a", tipo: "OPOSICION", asunto: "x", cuerpo: [] }).success,
    ).toBe(false);
  });
});

describe("normalizeEscritoInput", () => {
  it("mapea variantes del modelo a las claves del esquema", () => {
    const normalized = normalizeEscritoInput({
      case_id: 12,
      asunto: "Asunto",
      cuerpo: [
        { heading: "HECHOS", contenido: "Primer párrafo." },
        { seccion: "DERECHO", content: "Segundo párrafo." },
      ],
      pedidos: "Estimar el recurso",
      citas: [{ cita: "artículo 1.255 CC", norma: "CC 1255" }],
      encabezado: { organo: "Sala Primera", recurso: "6484/2023" },
      comprobar_antes: 5,
    }) as Record<string, unknown>;

    const parsed = escritoSchema.safeParse({ ...normalized, tipo: "ALEGACIONES" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cuerpo).toEqual([
        { titulo: "HECHOS", texto: "Primer párrafo." },
        { titulo: "DERECHO", texto: "Segundo párrafo." },
      ]);
      expect(parsed.data.pedidos).toEqual(["Estimar el recurso"]);
      expect(parsed.data.citas[0]?.fuente).toBe("CC 1255");
      expect(parsed.data.encabezado.tribunal).toBe("Sala Primera");
      expect(parsed.data.encabezado.numero_recurso).toBe("6484/2023");
      expect(parsed.data.comprobar_antes).toEqual([]);
    }
  });
});

describe("renderEscritoContext", () => {
  const rendered = renderEscritoContext(context);

  it("incluye el caso, la norma verificada y el caso similar", () => {
    expect(rendered).toContain("DATOS DEL CASO");
    expect(rendered).toContain("Nulidad de cláusula suelo");
    expect(rendered).toContain("NORMAS VERIFICADAS");
    expect(rendered).toContain("El recurso de casación procederá.");
    expect(rendered).toContain("CASOS SIMILARES CON ARGUMENTOS ACEPTADOS");
    const similares = rendered.slice(rendered.indexOf("CASOS SIMILARES"));
    expect(similares).toContain("argumento aceptado");
    expect(similares).not.toContain("RECHAZADO");
  });

  it("fija las reglas anti alucinación y el aviso de revisión", () => {
    expect(rendered).toContain("No inventes hechos");
    expect(rendered).toContain("pendiente de revision por un letrado");
    expect(rendered).toContain("REGLAS");
  });
});

describe("buildEscritoPrompt", () => {
  it("es un único JSON con las claves exigidas", () => {
    const prompt = buildEscritoPrompt("case_000034", "RECURSO_CASACION");
    expect(prompt).toContain("UN SOLO objeto JSON valido");
    expect(prompt).toContain("comprobar_antes");
    expect(prompt).toContain("case_000034");
  });
});
