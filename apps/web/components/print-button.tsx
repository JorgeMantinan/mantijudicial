"use client";

export function PrintButton({ text = "Imprimir o guardar en PDF" }: { text?: string }) {
  return (
    <button
      type="button"
      className="no-print"
      onClick={() => window.print()}
      style={{ marginBottom: 12 }}
    >
      {text}
    </button>
  );
}
