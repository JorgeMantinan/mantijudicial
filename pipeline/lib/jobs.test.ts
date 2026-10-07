import { describe, expect, it } from "vitest";
import { JobRegistry } from "./jobs.js";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("JobRegistry", () => {
  it("crea trabajos con estado inicial", () => {
    const registry = new JobRegistry();
    const job = registry.create("ingest");
    expect(job.status).toBe("queued");
    expect(job.lines).toEqual([]);
    expect(registry.get(job.id)?.kind).toBe("ingest");
    expect(registry.get("no-existe")).toBeNull();
    expect(registry.list()).toHaveLength(1);
  });

  it("acumula líneas de log y las limita", () => {
    const registry = new JobRegistry();
    const job = registry.create("ingest");
    for (let i = 0; i < 600; i += 1) registry.append(job.id, `linea ${i}`);
    expect(registry.get(job.id)?.lines.length).toBe(500);
    expect(registry.get(job.id)?.lines[0]).toBe("linea 100");
  });

  it("serializa las tareas: no se solapan", async () => {
    const registry = new JobRegistry();
    const order: string[] = [];
    const first = registry.runExclusive(async () => {
      order.push("a:start");
      await wait(40);
      order.push("a:end");
      return "a";
    });
    const second = registry.runExclusive(async () => {
      order.push("b:start");
      await wait(5);
      order.push("b:end");
      return "b";
    });

    await expect(Promise.all([first, second])).resolves.toEqual(["a", "b"]);
    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("una tarea fallida no bloquea a la siguiente", async () => {
    const registry = new JobRegistry();
    const failing = registry.runExclusive(async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");
    await expect(registry.runExclusive(async () => "ok")).resolves.toBe("ok");
    expect(registry.isBusy()).toBe(false);
  });

  it("marca estados y detecta actividad", () => {
    const registry = new JobRegistry();
    const job = registry.create("ingest");
    registry.patch(job.id, { status: "running", caseId: "case_000081" });
    expect(registry.isBusy()).toBe(true);
    registry.patch(job.id, { status: "done", finishedAt: new Date().toISOString() });
    expect(registry.isBusy()).toBe(false);
  });

  it("enCola cuenta solo los trabajos del despacho que siguen activos", () => {
    const registry = new JobRegistry();
    const a = registry.create("ingest");
    registry.patch(a.id, { orgId: "org_A", status: "queued" });
    const b = registry.create("compare");
    registry.patch(b.id, { orgId: "org_A", status: "running" });
    const c = registry.create("ingest");
    registry.patch(c.id, { orgId: "org_B", status: "queued" });
    const d = registry.create("ingest");
    registry.patch(d.id, { orgId: "org_A", status: "done" });
    expect(registry.enCola("org_A")).toBe(2);
    expect(registry.enCola("org_B")).toBe(1);
    expect(registry.enCola("org_C")).toBe(0);
  });

  it("al crear purga los terminados de hace más de 24 h y conserva el resto", () => {
    const registry = new JobRegistry();
    const viejo = registry.create("ingest");
    registry.patch(viejo.id, {
      status: "done",
      finishedAt: new Date(Date.now() - 25 * 3_600_000).toISOString(),
    });
    const reciente = registry.create("ingest");
    registry.patch(reciente.id, {
      status: "error",
      finishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    });
    const enMarcha = registry.create("ingest"); // sin finishedAt: no se purga

    expect(registry.get(viejo.id)).toBeNull();
    expect(registry.get(reciente.id)).not.toBeNull();
    expect(registry.get(enMarcha.id)).not.toBeNull();
    expect(registry.list()).toHaveLength(2);
  });
});
