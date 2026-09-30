export const REVIEW_STATUSES = ["UNREVIEWED", "REVIEWED", "MODIFIED", "REJECTED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ReviewBlock {
  status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string;
}

export interface ReviewUpdate {
  status: ReviewStatus;
  reviewedBy: string;
  notes: string;
}

export interface ReviewValidation {
  ok: boolean;
  value?: ReviewUpdate;
  error?: string;
}

export function validateReviewUpdate(body: unknown): ReviewValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "cuerpo no válido" };
  const input = body as Record<string, unknown>;
  const status = input.status;
  if (typeof status !== "string" || !REVIEW_STATUSES.includes(status as ReviewStatus)) {
    return { ok: false, error: `status debe ser uno de ${REVIEW_STATUSES.join(", ")}` };
  }
  const reviewedBy = typeof input.reviewedBy === "string" ? input.reviewedBy.trim() : "";
  if (reviewedBy.length > 80) return { ok: false, error: "reviewedBy supera 80 caracteres" };
  if (status !== "UNREVIEWED" && reviewedBy.length === 0) {
    return { ok: false, error: "reviewedBy es obligatorio" };
  }
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (notes.length > 1000) return { ok: false, error: "notes supera 1000 caracteres" };
  if (status !== "UNREVIEWED" && notes.length === 0) {
    return { ok: false, error: "notes es obligatorio salvo para UNREVIEWED" };
  }
  return { ok: true, value: { status: status as ReviewStatus, reviewedBy, notes } };
}

export function buildReviewBlock(update: ReviewUpdate, now = new Date()): ReviewBlock {
  if (update.status === "UNREVIEWED") {
    return { status: "UNREVIEWED", reviewed_by: null, reviewed_at: null, notes: "" };
  }
  return {
    status: update.status,
    reviewed_by: update.reviewedBy,
    reviewed_at: now.toISOString(),
    notes: update.notes,
  };
}

export function applyReview(existing: unknown, update: ReviewUpdate, now = new Date()): unknown {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  base.review = buildReviewBlock(update, now);
  return base;
}
