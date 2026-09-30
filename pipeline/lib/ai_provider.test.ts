import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpAiProvider,
  OpencodeCliProvider,
  buildChatBody,
  createAIProvider,
  parseChatResponse,
  readHttpConfig,
} from "./ai_provider.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readHttpConfig", () => {
  it("devuelve null si no hay clave", () => {
    vi.stubEnv("AI_API_KEY", "");
    expect(readHttpConfig("modelo-que-pasa")).toBeNull();
  });

  it("usa los valores por defecto y respeta los overrides", () => {
    vi.stubEnv("AI_API_KEY", "sk-demo");
    vi.stubEnv("AI_BASE_URL", "https://api.ejemplo.com/v1/");
    vi.stubEnv("AI_MODEL", "modelo-activo");
    expect(readHttpConfig("modelo-ignorado")).toEqual({
      apiKey: "sk-demo",
      baseUrl: "https://api.ejemplo.com/v1",
      model: "modelo-activo",
      temperature: 0.2,
    });
  });

  it("sin AI_MODEL usa el modelo pasado por el pipeline", () => {
    vi.stubEnv("AI_API_KEY", "sk-demo");
    expect(readHttpConfig("modelo-del-pipeline")?.model).toBe("modelo-del-pipeline");
  });
});

describe("buildChatBody", () => {
  it("une prompt y archivos en un solo mensaje de usuario", () => {
    const body = buildChatBody("Devuelve JSON", ["archivo A", "archivo B"], {
      apiKey: "k",
      baseUrl: "https://api.x.com/v1",
      model: "m",
      temperature: 0.2,
    }) as { model: string; messages: Array<{ role: string; content: string }> };
    expect(body.model).toBe("m");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]?.role).toBe("user");
    expect(body.messages[1]?.content).toContain("Devuelve JSON");
    expect(body.messages[1]?.content).toContain("archivo A");
    expect(body.messages[1]?.content).toContain("archivo B");
    expect(body.messages[1]?.content).toContain("## CONTEXTO");
  });
});

describe("parseChatResponse", () => {
  it("lee texto y uso del modelo", () => {
    const result = parseChatResponse({
      choices: [{ message: { content: "  {\"ok\":true}  " } }],
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
    });
    expect(result.text).toBe('{"ok":true}');
    expect(result.tokens).toEqual({ input: 100, output: 40, total: 140 });
    expect(result.cost).toBeNull();
    expect(result.sessionID).toBeNull();
  });

  it("admite contenido en partes (formato tipo Anthropic)", () => {
    const result = parseChatResponse({
      choices: [{ message: { content: [{ type: "text", text: "parte1" }, { type: "text", text: "parte2" }] } }],
    });
    expect(result.text).toBe("parte1parte2");
    expect(result.tokens).toBeNull();
  });

  it("falla si no hay texto", () => {
    expect(() => parseChatResponse({ choices: [{ message: { content: "" } }] })).toThrow();
    expect(() => parseChatResponse({})).toThrow();
  });
});

describe("createAIProvider", () => {
  it("usa HTTP cuando hay clave", () => {
    vi.stubEnv("AI_API_KEY", "sk-demo");
    expect(createAIProvider()).toBeInstanceOf(HttpAiProvider);
  });

  it("permite forzar cada proveedor", () => {
    vi.stubEnv("AI_PROVIDER", "http");
    expect(createAIProvider()).toBeInstanceOf(HttpAiProvider);
    vi.stubEnv("AI_PROVIDER", "opencode");
    vi.stubEnv("AI_API_KEY", "sk-demo");
    expect(createAIProvider()).toBeInstanceOf(OpencodeCliProvider);
  });

  it("en local, sin clave, usa opencode", () => {
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_PROVIDER", "");
    expect(createAIProvider()).toBeInstanceOf(OpencodeCliProvider);
  });
});
