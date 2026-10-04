export interface RateLimitConfig {
  maxIntentos: number;
  ventanaMs: number;
}

/**
 * Límite de intentos por clave (IP + usuario). En memoria: cada proceso tiene
 * el suyo, suficiente para frenar la fuerza bruta contra login/MFA.
 */
export class RateLimiter {
  private registros = new Map<string, { intentos: number; resetAt: number }>();

  constructor(private config: RateLimitConfig = { maxIntentos: 5, ventanaMs: 15 * 60_000 }) {}

  /** Registra un intento. Devuelve false cuando se superó el límite. */
  intentar(clave: string, ahora = Date.now()): boolean {
    this.podar(ahora);
    const registro = this.registros.get(clave);
    if (!registro || registro.resetAt <= ahora) {
      this.registros.set(clave, { intentos: 1, resetAt: ahora + this.config.ventanaMs });
      return true;
    }
    if (registro.intentos >= this.config.maxIntentos) return false;
    registro.intentos += 1;
    return true;
  }

  /** Segundos de bloqueo restantes (0 si no hay bloqueo). */
  espera(clave: string, ahora = Date.now()): number {
    const registro = this.registros.get(clave);
    if (!registro || registro.resetAt <= ahora) return 0;
    if (registro.intentos < this.config.maxIntentos) return 0;
    return Math.ceil((registro.resetAt - ahora) / 1000);
  }

  /** Borra la clave: se llama cuando el intento tiene éxito. */
  liberar(clave: string): void {
    this.registros.delete(clave);
  }

  /** Tamaño actual (para tests y poda). */
  get tamaño(): number {
    return this.registros.size;
  }

  private podar(ahora: number): void {
    if (this.registros.size < 10_000) return;
    for (const [clave, registro] of this.registros) {
      if (registro.resetAt <= ahora) this.registros.delete(clave);
    }
  }
}

export function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
