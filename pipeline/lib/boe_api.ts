export const BOE_API_BASE = "https://www.boe.es/datosabiertos/api";
export const BOE_USER_AGENT =
  "MantiJudicial-pipeline/0.1 (reutilizacion de datos abiertos de la Agencia Estatal BOE)";

export class BoeHttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(status: number, url: string, body: string) {
    super(`BOE ${status} en ${url}: ${body.slice(0, 200)}`);
    this.name = "BoeHttpError";
    this.status = status;
    this.url = url;
  }
}

let nextSlot = 0;

async function throttle(minIntervalMs: number): Promise<void> {
  const now = Date.now();
  const wait = nextSlot - now;
  nextSlot = Math.max(now, nextSlot) + minIntervalMs;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface BoeGetOptions {
  accept: string;
  timeoutMs?: number;
  retries?: number;
  minIntervalMs?: number;
}

export async function boeGet(url: string, options: BoeGetOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const retries = options.retries ?? 4;
  const minIntervalMs = options.minIntervalMs ?? 400;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    await throttle(minIntervalMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: options.accept, "User-Agent": BOE_USER_AGENT },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.text();
      const body = await response.text().catch(() => "");
      if (!RETRYABLE.has(response.status)) throw new BoeHttpError(response.status, url, body);
      lastError = new BoeHttpError(response.status, url, body);
    } catch (error) {
      if (error instanceof BoeHttpError && !RETRYABLE.has(error.status)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function boeGetJson<T>(url: string, options: Omit<BoeGetOptions, "accept">): Promise<T> {
  const text = await boeGet(url, { ...options, accept: "application/json" });
  return JSON.parse(text) as T;
}
