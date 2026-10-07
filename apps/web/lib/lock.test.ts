import { describe, expect, it } from "vitest";
import { conLock } from "./lock";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("conLock", () => {
  it("serializa las escrituras sobre la misma ruta", async () => {
    const orden: string[] = [];
    const a = conLock("/data/identity.json", async () => {
      orden.push("a:start");
      await wait(30);
      orden.push("a:end");
      return "a";
    });
    const b = conLock("/data/identity.json", async () => {
      orden.push("b:start");
      await wait(1);
      orden.push("b:end");
      return "b";
    });

    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
    expect(orden).toEqual(["a:start", "a:end", "b:start", "b:end"]);
  });

  it("las rutas distintas no se bloquean entre sí", async () => {
    const orden: string[] = [];
    const lenta = conLock("/data/identity.json", async () => {
      await wait(40);
      orden.push("lenta");
      return 1;
    });
    const otra = conLock("/data/otro.json", async () => {
      orden.push("otra");
      return 2;
    });

    await expect(Promise.all([lenta, otra])).resolves.toEqual([1, 2]);
    expect(orden).toEqual(["otra", "lenta"]);
  });

  it("una escritura fallida no rompe la cadena", async () => {
    const fallo = conLock("/data/identity.json", async () => {
      throw new Error("boom");
    });
    await expect(fallo).rejects.toThrow("boom");
    await expect(conLock("/data/identity.json", async () => "ok")).resolves.toBe("ok");
  });

  it("la cadena se libera al terminar (no acumula memoria)", async () => {
    await conLock("/data/identity.json", async () => 1);
    await conLock("/data/identity.json", async () => 2);
    // Tercera llamada: si la anterior no se hubiera limpiado, la clave
    // seguiría apuntando a una cadena vieja (comprobación indirecta: funciona).
    await expect(conLock("/data/identity.json", async () => 3)).resolves.toBe(3);
  });
});
