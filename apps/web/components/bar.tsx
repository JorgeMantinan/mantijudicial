export function Bar({
  value,
  max,
  tone = "neutral",
}: {
  value: number;
  max: number;
  tone?: "ok" | "ko" | "accent" | "neutral";
}) {
  const pct = max > 0 ? Math.max(2, Math.min(100, Math.round((value / max) * 100))) : 0;
  const color =
    tone === "ok"
      ? "var(--green)"
      : tone === "ko"
        ? "var(--red)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--line)";
  return (
    <div
      aria-hidden
      style={{
        background: "var(--panel-2)",
        borderRadius: 4,
        height: 10,
        overflow: "hidden",
        minWidth: 90,
      }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}
