import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRAMITES, calcularFechaLimite, fechaEs, verificarTramite } from "./plazos.js";
import { REPO_ROOT } from "./paths.js";

const LEC_PATH = path.join(REPO_ROOT, "laws", "norms", "BOE-A-2000-323.json");

describe("calcularFechaLimite", () => {
  it("excluye inhábiles según los arts. 130.2 y 133.2 LEC", () => {
    const r = calcularFechaLimite({
      fechaNotificacion: "2026-01-05",
      dias: 5,
      excluyeInhabiles: true,
      incluyeAgosto: false,
      festivosExtra: [],
    });
    expect(r.fechaLimite).toBe("2026-01-13");
    expect(r.diasContados).toBe(5);
    expect(r.saltados.map((item) => item.fecha)).toEqual([
      "2026-01-06",
      "2026-01-10",
      "2026-01-11",
    ]);
    expect(r.avisos.join(" ")).toContain("comunidad autónoma");
  });

  it("cuenta naturales si no se excluyen inhábiles", () => {
    const r = calcularFechaLimite({
      fechaNotificacion: "2026-01-05",
      dias: 5,
      excluyeInhabiles: false,
      incluyeAgosto: false,
      festivosExtra: [],
    });
    expect(r.fechaLimite).toBe("2026-01-10");
    expect(r.saltados).toHaveLength(0);
  });

  it("respeta los festivos indicados", () => {
    const r = calcularFechaLimite({
      fechaNotificacion: "2026-01-05",
      dias: 2,
      excluyeInhabiles: true,
      incluyeAgosto: false,
      festivosExtra: ["2026-01-07"],
    });
    expect(r.fechaLimite).toBe("2026-01-09");
  });

  it("trata agosto como inhábil salvo que se indique", () => {
    const sinAgosto = calcularFechaLimite({
      fechaNotificacion: "2026-07-31",
      dias: 2,
      excluyeInhabiles: true,
      incluyeAgosto: false,
      festivosExtra: [],
    });
    expect(sinAgosto.fechaLimite).toBe("2026-09-02");

    const conAgosto = calcularFechaLimite({
      fechaNotificacion: "2026-07-31",
      dias: 2,
      excluyeInhabiles: true,
      incluyeAgosto: true,
      festivosExtra: [],
    });
    expect(conAgosto.fechaLimite).toBe("2026-08-04");
  });

  it("rechaza una fecha imposible", () => {
    expect(calcularFechaLimite({
      fechaNotificacion: "no-es-fecha",
      dias: 5,
      excluyeInhabiles: true,
      incluyeAgosto: false,
      festivosExtra: [],
    }).fechaLimite).toBe("");
  });

  it("formatea fechas al estilo español", () => {
    expect(fechaEs("2026-01-13")).toBe("13/01/2026");
    expect(fechaEs("")).toBe("—");
  });
});

describe("verificarTramite", () => {
  it("confirma el plazo cuando está en el texto del artículo", () => {
    const casacion = TRAMITES.find((item) => item.id === "casacion")!;
    const texto =
      "Artículo 479. Interposición del recurso. 1. El recurso de casación se interpondrá ante el " +
      "tribunal que haya dictado la resolución que se impugne dentro del plazo de veinte días " +
      "contados desde el día siguiente a la notificación de aquélla. 2. Si la resolución...";
    const result = verificarTramite(texto, casacion);
    expect(result.ok).toBe(true);
    expect(result.falta).toBeNull();
    expect(result.cita).toContain("veinte días");
  });

  it("avisa si la norma ha cambiado", () => {
    const casacion = TRAMITES.find((item) => item.id === "casacion")!;
    const result = verificarTramite("Artículo 479. Texto completamente distinto.", casacion);
    expect(result.ok).toBe(false);
    expect(result.falta).not.toBeNull();
  });

  it("cada trámite declara artículo y plazo", () => {
    expect(TRAMITES.length).toBeGreaterThanOrEqual(5);
    for (const tramite of TRAMITES) {
      expect(tramite.articulo).toMatch(/^\d+/);
      expect(tramite.dias).toBeGreaterThan(0);
      expect(tramite.verificacion.length).toBeGreaterThan(20);
    }
  });
});

describe("autoverificación contra la LEC descargada", () => {
  const disponible = existsSync(LEC_PATH);
  it.skipIf(!disponible)("todos los trámites siguen en el texto de la LEC", async () => {
    const fs = await import("node:fs/promises");
    const lec = JSON.parse(await fs.readFile(LEC_PATH, "utf8")) as {
      blocks: Array<{ id: string; texto: string }>;
    };
    for (const tramite of TRAMITES) {
      const block = lec.blocks.find((item) => item.id === tramite.bloque);
      expect(block, `falta el bloque ${tramite.bloque}`).toBeTruthy();
      const result = verificarTramite(block!.texto, tramite);
      expect(result.ok, `${tramite.nombre} (${tramite.articulo}) ya no dice ese plazo`).toBe(true);
    }
  });
});
