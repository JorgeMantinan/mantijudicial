/** Escape para CSV con separador ';': comillas dobles y anti-fórmula de Excel. */
export function csv(campo: string): string {
  const texto = String(campo ?? "");
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/**
 * Respuesta CSV descargable (BOM para Excel): centraliza content-type y
 * content-disposition. El nombre se sanea (solo [A-Za-z0-9._-]) para no
 * inyectar cabeceras con parámetros de la query.
 */
export function csvResponse(filename: string, filas: string[]): Response {
  const nombre = filename.replace(/[^A-Za-z0-9._-]/g, "_") || "datos.csv";
  return new Response(`\uFEFF${filas.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nombre}"`,
    },
  });
}
