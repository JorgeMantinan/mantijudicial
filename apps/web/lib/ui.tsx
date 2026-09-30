export function OutcomeBadge({ outcome }: { outcome: string }) {
  const cls =
    outcome === "ESTIMED"
      ? "ok"
      : outcome === "DISMISSED"
        ? "ko"
        : outcome === "PARTIALLY_ESTIMATED"
          ? "warn"
          : "";
  return <span className={`badge ${cls}`}>{outcome}</span>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}
