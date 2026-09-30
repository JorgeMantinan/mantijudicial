import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  IdentityError,
  IdentityStore,
  hashPassword,
  isValidEmail,
  verifyPassword,
} from "./identity.js";

const tmp = path.join(os.tmpdir(), `mj-identity-${process.pid}-${Date.now()}`);
const storePath = path.join(tmp, "identity.json");

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("contraseñas", () => {
  it("hashea con scrypt y verifica", () => {
    const hash = hashPassword("secreta-123");
    expect(hash.startsWith("scrypt$16384$")).toBe(true);
    expect(verifyPassword("secreta-123", hash)).toBe(true);
    expect(verifyPassword("otra", hash)).toBe(false);
  });

  it("rechaza hashes manipulados", () => {
    expect(verifyPassword("x", "plaintext")).toBe(false);
    expect(verifyPassword("x", "scrypt$999999999$aa$bb")).toBe(false);
  });

  it("valida correos", () => {
    expect(isValidEmail("abogado@despacho.es")).toBe(true);
    expect(isValidEmail("abogado@despacho")).toBe(false);
    expect(isValidEmail("sin-arroba")).toBe(false);
  });
});

describe("IdentityStore", () => {
  it("registra y autentica con correo normalizado", () => {
    const store = IdentityStore.empty();
    const user = store.registerUser({ email: " Ana@Despacho.ES ", name: "Ana", password: "12345678" });
    expect(user.email).toBe("ana@despacho.es");
    expect(store.authenticate("ANA@despacho.es", "12345678")?.id).toBe(user.id);
    expect(store.authenticate("ana@despacho.es", "mal")).toBeNull();
    expect(store.authenticate("otro@despacho.es", "12345678")).toBeNull();
  });

  it("valida registro", () => {
    const store = IdentityStore.empty();
    expect(() => store.registerUser({ email: "malo", name: "A", password: "12345678" })).toThrow(
      IdentityError,
    );
    expect(() => store.registerUser({ email: "a@b.es", name: "A", password: "corta" })).toThrow(
      "8 caracteres",
    );
    store.registerUser({ email: "a@b.es", name: "A", password: "12345678" });
    expect(() => store.registerUser({ email: "A@b.es", name: "B", password: "12345678" })).toThrow(
      "ya está registrado",
    );
  });

  it("crea sesiones con caducidad y las revoca", () => {
    const store = IdentityStore.empty();
    const firm = store.createFirm("Despacho");
    const user = store.registerUser({ email: "a@b.es", name: "A", password: "12345678" });
    store.addMembership(user.id, firm.id, "ORG_ADMIN");
    const now = new Date("2026-09-30T10:00:00.000Z");
    const session = store.createSession(user.id, firm.id, now);

    expect(store.getSession(session.token, now)?.userId).toBe(user.id);
    expect(store.getSession("no-es-token", now)).toBeNull();
    const after = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 15);
    expect(store.getSession(session.token, after)).toBeNull();
  });

  it("mapea la sesión a un actor con su rol y organizaciones", () => {
    const store = IdentityStore.empty();
    const firmA = store.createFirm("A");
    const firmB = store.createFirm("B");
    const user = store.registerUser({ email: "multi@b.es", name: "Multi", password: "12345678" });
    store.addMembership(user.id, firmA.id, "LAWYER");
    store.addMembership(user.id, firmB.id, "ORG_ADMIN");
    const session = store.createSession(user.id, firmA.id);

    const actor = store.actorFor(session);
    expect(actor).toEqual({
      userId: user.id,
      orgId: firmA.id,
      role: "LAWYER",
      orgIds: [firmA.id, firmB.id],
    });
  });

  it("sin membresía no hay actor", () => {
    const store = IdentityStore.empty();
    const firm = store.createFirm("A");
    const user = store.registerUser({ email: "x@b.es", name: "X", password: "12345678" });
    const session = store.createSession(user.id, firm.id);
    expect(store.actorFor(session)).toBeNull();
  });

  it("cambia la contraseña y invalida las sesiones abiertas", () => {
    const store = IdentityStore.empty();
    const firm = store.createFirm("Despacho");
    const user = store.registerUser({ email: "a@b.es", name: "A", password: "12345678" });
    store.addMembership(user.id, firm.id, "ORG_ADMIN");
    const now = new Date("2026-09-30T10:00:00.000Z");
    const session = store.createSession(user.id, firm.id, now);

    store.setPassword(user.id, "nueva-clave-9");
    expect(store.authenticate("a@b.es", "12345678")).toBeNull();
    expect(store.authenticate("a@b.es", "nueva-clave-9")?.id).toBe(user.id);
    expect(store.revokeSessionsOf(user.id)).toBe(1);
    expect(store.getSession(session.token, now)).toBeNull();
    expect(() => store.setPassword(user.id, "corta")).toThrow("8 caracteres");
  });

  it("persiste y recarga el almacén", async () => {
    const store = IdentityStore.empty();
    const firm = store.createFirm("Despacho local");
    const user = store.registerUser({ email: "admin@local.test", name: "Admin", password: "12345678" });
    store.addMembership(user.id, firm.id, "ORG_ADMIN");
    await store.save(storePath);

    const reloaded = await IdentityStore.load(storePath);
    expect(reloaded.listUsers()).toHaveLength(1);
    expect(reloaded.listFirms()[0]?.name).toBe("Despacho local");
    expect(reloaded.listMemberships()[0]?.role).toBe("ORG_ADMIN");
    expect(reloaded.authenticate("admin@local.test", "12345678")?.email).toBe("admin@local.test");
  });

  it("devuelve almacén vacío si el fichero no existe", async () => {
    const store = await IdentityStore.load(path.join(tmp, "no-existe.json"));
    expect(store.listUsers()).toEqual([]);
  });
});
