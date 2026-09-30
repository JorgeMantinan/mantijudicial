import { describe, expect, it } from "vitest";
import { applyReview, buildReviewBlock, validateReviewUpdate } from "./review.js";

describe("validateReviewUpdate", () => {
  it("acepta una revisión completa", () => {
    const result = validateReviewUpdate({
      status: "REVIEWED",
      reviewedBy: "abogado@email",
      notes: "Coincide con el fallo.",
    });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      status: "REVIEWED",
      reviewedBy: "abogado@email",
      notes: "Coincide con el fallo.",
    });
  });

  it("rechaza estados desconocidos", () => {
    expect(validateReviewUpdate({ status: "APROBADO", reviewedBy: "x", notes: "n" }).ok).toBe(false);
  });

  it("exige quién revisa al marcar un estado", () => {
    expect(validateReviewUpdate({ status: "REVIEWED", reviewedBy: "  ", notes: "n" }).ok).toBe(false);
    expect(validateReviewUpdate({ status: "UNREVIEWED", reviewedBy: "", notes: "" }).ok).toBe(true);
  });

  it("exige notas salvo al desmarcar", () => {
    expect(validateReviewUpdate({ status: "REJECTED", reviewedBy: "a", notes: "" }).ok).toBe(false);
    expect(validateReviewUpdate({ status: "UNREVIEWED", reviewedBy: "a", notes: "" }).ok).toBe(true);
  });

  it("limita la longitud de las notas", () => {
    expect(validateReviewUpdate({ status: "REVIEWED", reviewedBy: "a", notes: "x".repeat(1001) }).ok).toBe(
      false,
    );
  });
});

describe("buildReviewBlock", () => {
  const now = new Date("2026-09-30T10:00:00.000Z");

  it("marca quién y cuándo revisó", () => {
    expect(
      buildReviewBlock({ status: "MODIFIED", reviewedBy: "ana", notes: "corregido" }, now),
    ).toEqual({
      status: "MODIFIED",
      reviewed_by: "ana",
      reviewed_at: "2026-09-30T10:00:00.000Z",
      notes: "corregido",
    });
  });

  it("limpia los datos al volver a UNREVIEWED", () => {
    expect(buildReviewBlock({ status: "UNREVIEWED", reviewedBy: "ana", notes: "x" }, now)).toEqual({
      status: "UNREVIEWED",
      reviewed_by: null,
      reviewed_at: null,
      notes: "",
    });
  });
});

describe("applyReview", () => {
  it("conserva la trazabilidad de la extracción", () => {
    const updated = applyReview(
      { case_id: "CASE-000001", extraction: { model: "mimo", validation: "OK" }, review: { status: "UNREVIEWED" } },
      { status: "REVIEWED", reviewedBy: "luis", notes: "ok" },
    ) as Record<string, unknown>;
    expect(updated.case_id).toBe("CASE-000001");
    expect((updated.extraction as { validation: string }).validation).toBe("OK");
    expect((updated.review as { status: string }).status).toBe("REVIEWED");
  });

  it("crea el bloque si no existe", () => {
    const updated = applyReview(undefined, { status: "REJECTED", reviewedBy: "luis", notes: "sin datos" });
    expect((updated as { review: { status: string } }).review.status).toBe("REJECTED");
  });
});
