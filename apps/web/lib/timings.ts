export interface Medicion {
  at: string;
  ms: number;
}

const buffer: Medicion[] = [];

/** Preámbulo del layout raíz por petición (no el render completo de la página). */
export function registrarRender(ms: number): void {
  buffer.push({ at: new Date().toISOString(), ms: Math.round(ms) });
  if (buffer.length > 50) buffer.shift();
}

export function ultimasMediciones(limite = 15): Medicion[] {
  return [...buffer].reverse().slice(0, limite);
}
