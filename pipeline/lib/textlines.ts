export interface TextItemLike {
  str: string;
  x: number;
  y: number;
  width: number;
  hasEOL?: boolean;
}

function needsSpace(prev: TextItemLike, next: TextItemLike): boolean {
  if (prev.str.endsWith(" ") || next.str.startsWith(" ")) return false;
  const gap = next.x - (prev.x + prev.width);
  return gap > 0.08;
}

function joinItems(segment: TextItemLike[]): string {
  let line = "";
  for (let i = 0; i < segment.length; i++) {
    const item = segment[i];
    if (!item) continue;
    const prev = i > 0 ? segment[i - 1] : undefined;
    if (prev && line.length > 0 && needsSpace(prev, item)) line += " ";
    line += item.str;
  }
  return line.replace(/\s+/g, " ").trim();
}

export function itemsToLines(items: TextItemLike[]): string[] {
  const lines: string[] = [];
  let segment: TextItemLike[] = [];

  for (const item of items) {
    if (item.str.length === 0 && !item.hasEOL) continue;
    if (item.str.length > 0) segment.push(item);
    if (item.hasEOL) {
      const line = joinItems(segment);
      if (line.length > 0) lines.push(line);
      segment = [];
    }
  }
  const last = joinItems(segment);
  if (last.length > 0) lines.push(last);
  return lines;
}
