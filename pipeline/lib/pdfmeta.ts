export interface PdfHeaderInfo {
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  producer: string | null;
  creationDate: string | null;
}

export interface CendojIdentity {
  roj: string | null;
  rojNumber: string | null;
  rojYear: string | null;
  ecli: string | null;
  court: string | null;
}

const DICT_KEYS = ["Title", "Author", "Subject", "Keywords", "Producer", "CreationDate"] as const;

function decodeLiteral(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = value[i + 1];
    if (next === undefined) break;
    if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next >= "0" && next <= "7") {
      const octal = value.slice(i + 1, i + 4).match(/^[0-7]{1,3}/);
      if (octal) {
        out += String.fromCharCode(parseInt(octal[0], 8));
        i += octal[0].length;
        continue;
      }
      out += next;
      i += 1;
    } else {
      out += next;
      i += 1;
    }
  }
  return out;
}

function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  const bytes = Buffer.from(clean.length % 2 === 0 ? clean : clean.slice(0, -1), "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const swaps = Buffer.from(bytes.subarray(2));
    for (let i = 0; i + 1 < swaps.length; i += 2) {
      const tmp = swaps[i];
      swaps[i] = swaps[i + 1] ?? 0;
      swaps[i + 1] = tmp ?? 0;
    }
    return swaps.toString("utf16le");
  }
  return bytes.toString("latin1");
}

function readInfoDict(head: string): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  for (const key of DICT_KEYS) {
    const re = new RegExp(`/${key}\\s*(\\((?:[^()\\\\]|\\\\.)*\\)|<[0-9A-Fa-f\\s]*>)`);
    const match = head.match(re);
    if (!match || match[1] === undefined) {
      result[key] = null;
      continue;
    }
    const raw = match[1];
    result[key] = raw.startsWith("(") ? decodeLiteral(raw.slice(1, -1)) : decodeHexString(raw.slice(1, -1));
  }
  return result;
}

export function parsePdfHeaderInfo(bytes: Buffer): PdfHeaderInfo {
  const head = bytes.subarray(0, 8192).toString("latin1");
  const dict = readInfoDict(head);
  return {
    title: dict.Title ?? null,
    author: dict.Author ?? null,
    subject: dict.Subject ?? null,
    keywords: dict.Keywords ?? null,
    producer: dict.Producer ?? null,
    creationDate: dict.CreationDate ?? null,
  };
}

export function parseCendojIdentity(info: PdfHeaderInfo): CendojIdentity {
  const haystack = [info.title, info.keywords].filter((v): v is string => Boolean(v)).join(" ");
  const rojMatch = haystack.match(/STS\s*(\d+)\s*\/\s*(\d{4})/);
  const ecliMatch = haystack.match(/ECLI:?(ES:[A-Z]{2}:\d{4}:\d+)/);
  const court = info.subject ? info.subject.split(" - ")[0]?.trim() ?? null : null;
  const roj = rojMatch?.[1] && rojMatch[2] ? `STS ${rojMatch[1]}/${rojMatch[2]}` : null;
  return {
    roj,
    rojNumber: rojMatch?.[1] ?? null,
    rojYear: rojMatch?.[2] ?? null,
    ecli: ecliMatch?.[1] ?? null,
    court,
  };
}
