import { afterEach, describe, expect, it, vi } from "vitest";
import { boeGet, boeGetJson, BoeHttpError, BOE_USER_AGENT } from "./boe_api.js";

/** Las pruebas no salen a la red: se sustituye `fetch` por un doble. */
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("boeGet", () => {
  it("devuelve el texto del BOE con sus cabeceras", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response("Sumario del BOE", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const texto = await boeGet("https://www.boe.es/datosabiertos/api/sumario/20260101", {
      accept: "application/json",
      minIntervalMs: 0,
    });

    expect(texto).toBe("Sumario del BOE");
    const [url, init] = fetchMock.mock.calls[0] ?? ["", undefined];
    expect(url).toBe("https://www.boe.es/datosabiertos/api/sumario/20260101");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Accept).toBe("application/json");
    expect(headers["User-Agent"]).toBe(BOE_USER_AGENT);
  });

  it("lanza BoeHttpError sin reintentar ante un estado no reintentable", async () => {
    const fetchMock = vi.fn(async () => new Response("No encontrado", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const promesa = boeGet("https://www.boe.es/datosabiertos/api/boe/1", {
      accept: "application/xml",
      retries: 3,
      minIntervalMs: 0,
    });

    await expect(promesa).rejects.toBeInstanceOf(BoeHttpError);
    await promesa.catch((error: unknown) => {
      expect(error).toMatchObject({
        status: 404,
        url: "https://www.boe.es/datosabiertos/api/boe/1",
        name: "BoeHttpError",
      });
      expect((error as Error).message).toContain("BOE 404");
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintenta los estados transitorios y falla al agotar los intentos", async () => {
    const fetchMock = vi.fn(async () => new Response("Servidor ocupado", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const promesa = boeGet("https://www.boe.es/datosabiertos/api/boe/2", {
      accept: "application/xml",
      retries: 1,
      minIntervalMs: 0,
    });

    await expect(promesa).rejects.toBeInstanceOf(BoeHttpError);
    await promesa.catch((error: unknown) => {
      expect((error as BoeHttpError).status).toBe(503);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("boeGetJson parsea la respuesta", async () => {
    const fetchMock = vi.fn(async (_url: string | URL, _init?: RequestInit) =>
      new Response('{"titulo":"Código Civil","boe_id":"BOE-A-1889-4763"}', { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const json = await boeGetJson<{ titulo: string; boe_id: string }>(
      "https://www.boe.es/datosabiertos/api/normativa/BOE-A-1889-4763",
      { minIntervalMs: 0, retries: 0 },
    );

    expect(json.titulo).toBe("Código Civil");
    expect(json.boe_id).toBe("BOE-A-1889-4763");
    const [, init] = fetchMock.mock.calls[0] ?? ["", undefined];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Accept).toBe("application/json");
  });
});
