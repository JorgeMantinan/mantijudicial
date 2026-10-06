import { Buffer } from "node:buffer";

const MAX_JSON = 2 * 1024 * 1024;

/**
 * `request.json()` con tope: corta el stream al llegar al límite en lugar de
 * buffering completo. Los route handlers no tienen límite por defecto y un
 * cuerpo *chunked* sin `content-length` esquiva el chequeo del proxy, así
 * que el límite se aplica también aquí (2 MB).
 * Sobre el límite lanza; los handlers ya devuelven 400 en su try/catch.
 */
export async function leerJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const texto = (await leerBytes(request, MAX_JSON)).toString("utf8");
  return JSON.parse(texto) as T;
}

/** Lee el cuerpo con tope y lo devuelve cortado (o lanza si se pasa). */
export async function leerBytes(request: Request, max: number): Promise<Buffer> {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Cuerpo demasiado grande");
    }
    partes.push(value);
  }
  return Buffer.concat(partes);
}
