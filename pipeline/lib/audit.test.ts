import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { appendAudit, readAudit } from "./audit.js";

const tmp = path.join(os.tmpdir(), `mj-audit-${process.pid}-${Date.now()}`);
const logPath = path.join(tmp, "audit.log");

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("audit", () => {
  it("registra acciones en orden", async () => {
    await appendAudit(logPath, {
      actor: "usr_1",
      action: "share.grant",
      resource: "case_000034",
      details: { grantee: "usr_2", actions: ["VIEW"] },
    });
    await appendAudit(logPath, {
      actor: "usr_1",
      action: "share.revoke",
      resource: "case_000034",
      details: {},
    });

    const entries = await readAudit(logPath);
    expect(entries.map((entry) => entry.action)).toEqual(["share.grant", "share.revoke"]);
    expect(entries[0]?.details.grantee).toBe("usr_2");
    expect(entries[0]?.at).toBeTruthy();
  });

  it("limita el número de entradas leídas", async () => {
    for (let i = 0; i < 10; i += 1) {
      await appendAudit(logPath, { actor: "u", action: "review.update", resource: `case_00000${i}`, details: {} });
    }
    expect((await readAudit(logPath, 3)).length).toBe(3);
  });

  it("devuelve vacío si no existe el fichero", async () => {
    expect(await readAudit(path.join(tmp, "no-existe.log"))).toEqual([]);
  });

  it("ignora líneas corruptas sin perder el resto", async () => {
    const broken = path.join(tmp, "roto.log");
    await fs.mkdir(tmp, { recursive: true });
    await fs.writeFile(broken, '{"at":"x"}\nesto no es json\n', "utf8");
    const entries = await readAudit(broken);
    expect(entries).toHaveLength(1);
  });
});
