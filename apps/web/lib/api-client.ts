/** Error de API con el mensaje en castellano que devolvió el servidor. */
export class ErrorApi extends Error {}

/**
 * fetch con manejo uniforme de errores: devuelve el JSON tipado o lanza
 * `ErrorApi` con el `error` del servidor (o `fallback`). La caída de red se
 * distingue con "No se pudo contactar con el servidor".
 *
 *   try {
 *     await pedir("/api/x", { method: "POST", body }, "No se pudo guardar");
 *   } catch (error) {
 *     setError(error instanceof Error ? error.message : "No se pudo guardar");
 *   }
 */
export async function pedir<T>(
  url: string,
  init?: RequestInit,
  fallback = "No se pudo completar la operación",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ErrorApi("No se pudo contactar con el servidor");
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new ErrorApi((payload as { error?: string } | null)?.error || fallback);
  }
  return payload as T;
}

/** Igual que `pedir`, pero para GETs de carga: devuelve `null` en cualquier
 * fallo (red, 4xx, JSON roto) sin lanzar, para usar en `useEffect`. */
export async function pedirOpcional<T>(url: string): Promise<T | null> {
  try {
    return await pedir<T>(url);
  } catch {
    return null;
  }
}
