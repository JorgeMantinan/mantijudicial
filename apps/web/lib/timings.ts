export interface Medicion {
  at: string;
  ms: number;
}

const buffer: Medicion[] = [];

/** Tiempo de render de la última petición (se mide en el layout raíz). */
export function registrarRender(ms: number): void {
  buffer.push({ at: new Date().toISOString(), ms: Math.round(ms) });
  if (buffer.length > 50) buffer.shift();
}

export function ultimasMediciones(limite = 15): Medicion[] {
  return [...buffer].reverse().slice(0, limite);
}
