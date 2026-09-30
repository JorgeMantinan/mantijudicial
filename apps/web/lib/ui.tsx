import { label, OUTCOME } from "./labels";

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const cls =
    outcome === "ESTIMED"
      ? "ok"
      : outcome === "DISMISSED"
        ? "ko"
        : outcome === "PARTIALLY_ESTIMATED"
          ? "warn"
          : "";
  return (
    <span className={`badge ${cls}`} title={outcome}>
      {label(OUTCOME, outcome)}
    </span>
  );
}

export function Tag({ children, raw }: { children: React.ReactNode; raw?: string }) {
  return (
    <span className="badge" title={raw}>
      {children}
    </span>
  );
}

export function Code({ value }: { value: string }) {
  return (
    <span className="badge mono" title={value}>
      {value}
    </span>
  );
}
