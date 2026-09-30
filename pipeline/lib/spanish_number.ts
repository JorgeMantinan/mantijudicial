const LEX: Record<string, number> = {
  cero: 0,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
  mil: 1000,
  primero: 1,
  segunda: 2,
  segundo: 2,
  tercera: 3,
  tercero: 3,
  cuarta: 4,
  cuarto: 4,
  quinta: 5,
  quinto: 5,
  sexta: 6,
  sexto: 6,
  septima: 7,
  septimo: 7,
  octava: 8,
  octavo: 8,
  novena: 9,
  noveno: 9,
  decima: 10,
  decimo: 10,
  y: 0,
  bis: 0,
  ter: 0,
  quater: 0,
  quinquies: 0,
  sexies: 0,
  septies: 0,
  octies: 0,
  nonies: 0,
  undecies: 0,
  duodecies: 0,
};

const KEYS = Object.keys(LEX).sort((a, b) => b.length - a.length);

function normalize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function segment(text: string, pos: number, memo: Map<number, number[] | null>): number[] | null {
  if (pos >= text.length) return [];
  const cached = memo.get(pos);
  if (cached !== undefined) return cached;
  for (const key of KEYS) {
    if (!text.startsWith(key, pos)) continue;
    const rest = segment(text, pos + key.length, memo);
    if (rest !== null) {
      const values = [LEX[key] ?? 0, ...rest];
      memo.set(pos, values);
      return values;
    }
  }
  memo.set(pos, null);
  return null;
}

function sum(values: number[]): number {
  let total = 0;
  let current = 0;
  for (const value of values) {
    if (value === 0) continue;
    if (value === 1000) {
      total += (current || 1) * 1000;
      current = 0;
      continue;
    }
    if (value === 100 || value >= 200) {
      current = current === 0 ? value : current + value;
      continue;
    }
    current += value;
  }
  return total + current;
}

export function spanishNumberToInt(raw: string): number | null {
  const text = normalize(raw);
  if (text.length === 0) return null;
  const values = segment(text, 0, new Map());
  if (values === null || values.every((value) => value === 0)) return null;
  const result = sum(values);
  return result > 0 ? result : null;
}
