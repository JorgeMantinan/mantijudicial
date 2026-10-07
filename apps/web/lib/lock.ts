/**
 * Cadena de escritura por ruta: serializa las operaciones
 * "leer → mutar → guardar" sobre el mismo fichero de datos (p. ej.
 * `data/identity.json`) para que dos peticiones concurrentes no se piseln.
 *
 * Sin esto, dos logins simultáneos cargan la misma copia, cada uno añade su
 * sesión y el segundo `save()` se come el primero (carrera clásica
 * load→mutate→save).
 *
 * Patrón de uso (el `load` y el `save` van DENTRO del callback):
 *
 * ```ts
 * const session = await conLock(identityPath(), async () => {
 *   const identity = await loadIdentity();
 *   const session = identity.createSession(userId, firmId);
 *   await identity.save(identityPath());
 *   return session;
 * });
 * ```
 *
 * Las lecturas que no escriben (p. ej. `getActor()`) no hace falta que pasen
 * por aquí: `save()` escribe atómicamente (tmp + rename), así que un lector
 * siempre ve un fichero completo.
 */
const cadenas = new Map<string, Promise<unknown>>();

/** Ejecuta `fn` cuando la cadena anterior de `ruta` termine (bien o mal). */
export async function conLock<T>(ruta: string, fn: () => Promise<T>): Promise<T> {
  const anterior = cadenas.get(ruta) ?? Promise.resolve();
  const mia = anterior.then(fn, fn);
  const cola = mia.then(
    () => undefined,
    () => undefined,
  );
  cadenas.set(ruta, cola);
  try {
    return await mia;
  } finally {
    // Solo limpiar si nadie se ha encadenado detrás de nosotros.
    if (cadenas.get(ruta) === cola) cadenas.delete(ruta);
  }
}
