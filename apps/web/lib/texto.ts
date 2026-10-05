/** Fecha AAAA-MM-DD (o YYYYMMDD) → DD/MM/AAAA; si no es válida, el valor original. */
export function fechaEs(yyyymmdd: string | null | undefined): string {
  if (!/^(\d{8}|\d{4}-\d{2}-\d{2})$/.test(yyyymmdd ?? "")) return yyyymmdd || "—";
  const limpio = yyyymmdd!.replace(/-/g, "");
  return `${limpio.slice(6, 8)}/${limpio.slice(4, 6)}/${limpio.slice(0, 4)}`;
}

/** Recorta texto largo añadiendo elípsis. */
export function cortar(texto: string, max = 80): string {
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}
