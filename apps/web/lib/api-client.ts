/** Error de API con el mensaje en castellano que devolvió el servidor y,
 * si lo había, el JSON completo (para leer flags como `mfaRequired`). */
export class ErrorApi extends Error {
  constructor(
    message: string,
    readonly payload?: unknown,
  ) {
    super(message);
  }
}

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
    throw new ErrorApi(
      (payload as { error?: string } | null)?.error || fallback,
      payload ?? undefined,
    );
  }
  return payload as T;
}

/** Igual que `pedir`, pero para GETs de carga: devuelve `null` en cualquier
 * fallo (red, 4xx, JSON roto) sin lanzar, para usar en `useEffect`. */
export async function pedirOpcional<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await pedir<T>(url, init);
  } catch {
    return null;
  }
}
