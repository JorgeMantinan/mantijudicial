"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface BlockRow {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  path: string[];
}

export function BlockIndex({
  blocks,
  boeId,
  initial = "",
}: {
  blocks: BlockRow[];
  boeId: string;
  initial?: string;
}) {
  const [q, setQ] = useState(initial);
  const needle = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const estructura = blocks.filter(
      (block) => block.tipo !== "precepto" || block.titulo.startsWith("Art 1"),
    );
    if (!needle) return estructura;
    const exactos = blocks.filter((block) =>
      `${block.id} ${block.titulo}`.toLowerCase().includes(needle),
    );
    return exactos.length > 0 ? exactos : estructura;
  }, [blocks, needle]);

  return (
    <div>
      <div className="filters">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Filtra al vuelo: Art 1124, costas, 1881…"
          style={{ minWidth: 280 }}
        />
        <span className="small muted">
          {needle ? `${rows.length} bloques coinciden` : `${rows.length} bloques de estructura (escribe para ver todos)`}
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Bloque</th>
            <th>Tipo</th>
            <th>Vigencia</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((block) => (
            <tr key={block.id}>
              <td>
                <Link href={`/laws/${boeId}?block=${encodeURIComponent(block.id)}`}>
                  {block.titulo || block.id}
                </Link>
                {block.path.length > 1 && (
                  <div className="small muted">{block.path.slice(0, -1).join(" › ")}</div>
                )}
              </td>
              <td className="small">{block.tipo}</td>
              <td className="mono small">{block.fecha}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
