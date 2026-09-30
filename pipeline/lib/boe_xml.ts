export interface BoeVersion {
  fecha_vigencia: string;
  fecha_publicacion: string;
  texto: string;
}

export interface BoeBlockSource {
  id: string;
  tipo: string;
  titulo: string;
  fecha_vigencia: string;
  fecha_publicacion: string;
  texto: string;
  /** Todas las versiones del bloque, de la más antigua a la más reciente. */
  versions: BoeVersion[];
}

interface Tag {
  name: string;
  closing: boolean;
  selfClosing: boolean;
  attrs: Record<string, string>;
  start: number;
  end: number;
}

function findTagEnd(text: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ">") return i;
  }
  return -1;
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"|([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const key = match[1] ?? match[3];
    const value = match[2] ?? match[4] ?? "";
    if (key) attrs[key] = decodeEntities(value);
  }
  return attrs;
}

function tokenize(xml: string): Tag[] {
  const tags: Tag[] = [];
  let i = 0;
  while (i < xml.length) {
    const open = xml.indexOf("<", i);
    if (open < 0) break;
    if (xml.startsWith("<?", open) || xml.startsWith("<!", open)) {
      const skip = xml.startsWith("<!--", open) ? xml.indexOf("-->", open) + 3 : xml.indexOf(">", open) + 1;
      i = skip > 0 ? skip : xml.length;
      continue;
    }
    const end = findTagEnd(xml, open + 1);
    if (end < 0) break;
    const raw = xml.slice(open + 1, end);
    const closing = raw.startsWith("/");
    const body = closing ? raw.slice(1) : raw;
    const selfClosing = body.trimEnd().endsWith("/");
    const nameMatch = /^([A-Za-z_][-A-Za-z0-9_:.]*)/.exec(selfClosing ? body.trimEnd().slice(0, -1) : body);
    if (!nameMatch) {
      i = end + 1;
      continue;
    }
    tags.push({
      name: nameMatch[1]!.toLowerCase(),
      closing,
      selfClosing,
      attrs: closing ? {} : parseAttrs(body.slice(nameMatch[0].length)),
      start: open,
      end: end + 1,
    });
    i = end + 1;
  }
  return tags;
}

interface Segment {
  attrs: Record<string, string>;
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
}

function segments(xml: string, tags: Tag[], name: string): Segment[] {
  const out: Segment[] = [];
  const stack: Tag[] = [];
  for (const tag of tags) {
    if (tag.name !== name) continue;
    if (!tag.closing) {
      if (tag.selfClosing) {
        out.push({ attrs: tag.attrs, start: tag.start, end: tag.end, innerStart: tag.end, innerEnd: tag.end });
      } else {
        stack.push(tag);
      }
      continue;
    }
    const open = stack.pop();
    if (!open) continue;
    out.push({
      attrs: open.attrs,
      start: open.start,
      end: tag.end,
      innerStart: open.end,
      innerEnd: tag.start,
    });
  }
  return out;
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp);/g, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower === "nbsp") return " ";
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    return String.fromCodePoint(parseInt(entity.slice(1), 10));
  });
}

export function innerToText(inner: string): string {
  const withBreaks = inner.replace(/<\/(p|li|tr|h[1-6]|div)\s*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]*>/g, "");
  const decoded = decodeEntities(withoutTags).replace(/\u00a0/g, " ");
  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

function pickVersion(versions: Segment[], today: string): Segment | null {
  if (versions.length === 0) return null;
  const sorted = [...versions].sort((a, b) =>
    (a.attrs.fecha_vigencia ?? "").localeCompare(b.attrs.fecha_vigencia ?? ""),
  );
  const inForce = sorted.filter((v) => (v.attrs.fecha_vigencia ?? "99999999") <= today);
  return inForce[inForce.length - 1] ?? sorted[0] ?? null;
}

export function parseTextoXml(xml: string, today: string): BoeBlockSource[] {
  const tags = tokenize(xml);
  const blocks = segments(xml, tags, "bloque");
  const versionSegments = segments(xml, tags, "version");
  const out: BoeBlockSource[] = [];

  let pointer = 0;
  for (const block of blocks) {
    while (pointer < versionSegments.length && versionSegments[pointer]!.end <= block.start)
      pointer += 1;
    const mine: Segment[] = [];
    for (let i = pointer; i < versionSegments.length; i += 1) {
      const version = versionSegments[i]!;
      if (version.start >= block.end) break;
      if (version.start >= block.innerStart && version.end <= block.innerEnd) mine.push(version);
    }
    const chosen = pickVersion(mine, today);
    if (!chosen) continue;
    const allVersions = mine
      .map((version) => ({
        fecha_vigencia: version.attrs.fecha_vigencia ?? "",
        fecha_publicacion: version.attrs.fecha_publicacion ?? "",
        texto: innerToText(xml.slice(version.innerStart, version.innerEnd)),
      }))
      .filter((version) => version.texto.length > 0)
      .sort((a, b) => a.fecha_vigencia.localeCompare(b.fecha_vigencia));
    if (allVersions.length === 0) continue;
    const texto = innerToText(xml.slice(chosen.innerStart, chosen.innerEnd));
    if (texto.length === 0) continue;
    out.push({
      id: block.attrs.id ?? "",
      tipo: block.attrs.tipo ?? "",
      titulo: "",
      fecha_vigencia: chosen.attrs.fecha_vigencia ?? "",
      fecha_publicacion: chosen.attrs.fecha_publicacion ?? "",
      texto,
      versions: allVersions,
    });
  }
  return out;
}

export interface IndexEntry {
  id: string;
  titulo: string;
  fecha_actualizacion: string;
}

export function parseIndiceJson(payload: unknown): IndexEntry[] {
  const data = (payload as { data?: unknown }).data;
  const list = Array.isArray(data) ? data : [];
  const out: IndexEntry[] = [];
  for (const item of list) {
    const bloques = (item as { bloque?: unknown }).bloque;
    if (!Array.isArray(bloques)) continue;
    for (const bloque of bloques) {
      const b = bloque as { id?: string; titulo?: string; fecha_actualizacion?: string };
      if (!b.id) continue;
      out.push({
        id: b.id,
        titulo: b.titulo ?? "",
        fecha_actualizacion: b.fecha_actualizacion ?? "",
      });
    }
  }
  return out;
}
