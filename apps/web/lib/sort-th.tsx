import Link from "next/link";

/**
 * Cabecera de tabla ordenable: mantiene el resto de filtros y alterna asc/desc.
 */
export function SortTh({
  path,
  sortKey,
  current,
  dir,
  label,
  base = {},
}: {
  path: string;
  sortKey: string;
  current: string;
  dir: string;
  label: string;
  base?: Record<string, string | undefined>;
}) {
  const nextDir = current === sortKey && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(base)) {
    if (value) params.set(key, value);
  }
  params.set("sort", sortKey);
  params.set("dir", nextDir);
  const arrow = current === sortKey ? (dir === "asc" ? " ▲" : " ▼") : "";
  return (
    <th>
      <Link href={`${path}?${params.toString()}`}>
        {label}
        {arrow}
      </Link>
    </th>
  );
}
