import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorApi, pedir, pedirOpcional } from "./api-client";

function respuesta(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pedir", () => {
  it("con 200 devuelve el JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(200, { total: 3 })));
    await expect(pedir("/api/resumen")).resolves.toEqual({ total: 3 });
  });

  it("con 401 lanza ErrorApi con el mensaje del servidor y el payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuesta(401, { error: "Sesión caducada" })),
    );
    const error = await pedir("/api/quien-soy").catch((capturado: unknown) => capturado);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).message).toBe("Sesión caducada");
    expect((error as ErrorApi).payload).toEqual({ error: "Sesión caducada" });
  });

  it("si cae la red avisa que no hay servidor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(pedir("/api/resumen")).rejects.toThrow(
      "No se pudo contactar con el servidor",
    );
  });

  it("sin error en el cuerpo usa el mensaje alternativo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(500, {})));
    await expect(pedir("/api/resumen", undefined, "No se pudo guardar")).rejects.toThrow(
      "No se pudo guardar",
    );
  });
});

describe("pedirOpcional", () => {
  it("devuelve null si la red cae", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(pedirOpcional("/api/casos")).resolves.toBeNull();
  });

  it("devuelve los datos en éxito", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respuesta(200, { casos: ["case_000001"] })),
    );
    await expect(pedirOpcional<{ casos: string[] }>("/api/casos")).resolves.toEqual({
      casos: ["case_000001"],
    });
  });
});
