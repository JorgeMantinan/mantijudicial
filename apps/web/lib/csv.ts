/** Escape para CSV con separador ';': comillas dobles y anti-fórmula de Excel. */
export function csv(campo: string): string {
  const texto = String(campo ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
