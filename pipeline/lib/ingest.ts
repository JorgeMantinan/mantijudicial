export function nextCaseId(existing: string[]): string {
  let max = 0;
  for (const name of existing) {
    const match = /^case_(\d{6})$/.exec(name);
    if (!match?.[1]) continue;
    const value = Number(match[1]);
    if (value > max) max = value;
  }
  return `case_${String(max + 1).padStart(6, "0")}`;
}

export function sanitizePdfName(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "documento.pdf";
  const cleaned = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.]+/, "");
  const withExtension = /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
  return withExtension.toLowerCase();
}

export function looksLikePdf(head: Uint8Array | Buffer): boolean {
  const signature = Buffer.from(head.subarray(0, 5)).toString("latin1");
  return signature === "%PDF-";
}

export function parseIngestArgs(argv: string[]): {
  file: string | null;
  id: string | null;
  source: string;
  skipEnrich: boolean;
  refresh: boolean;
} {
  const args = {
    file: null as string | null,
    id: null as string | null,
    source: "UPLOAD",
    skipEnrich: false,
    refresh: true,
  };
  for (const arg of argv) {
    if (arg === "--skip-enrich") args.skipEnrich = true;
    else if (arg === "--no-refresh") args.refresh = false;
    else {
      const file = arg.match(/^--file=(.+)$/);
      const id = arg.match(/^--id=(case_\d{6})$/);
      const source = arg.match(/^--source=(.+)$/);
      if (file?.[1]) args.file = file[1];
      else if (id?.[1]) args.id = id[1];
      else if (source?.[1]) args.source = source[1];
    }
  }
  return args;
}
