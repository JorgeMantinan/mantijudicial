import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { NoteError, NoteStore } from "./notes.js";

const tmp = path.join(os.tmpdir(), `mj-notes-${process.pid}-${Date.now()}`);
const filePath = path.join(tmp, "notes.json");

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("NoteStore", () => {
  it("añade notas y solo las ve su autor", () => {
    const store = NoteStore.empty();
    store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "Revisar la base legal" });
    store.add({ caseId: "case_000034", userId: "u2", userName: "Carlos", text: "No usar" });

    expect(store.listFor("u1")).toHaveLength(1);
    expect(store.listFor("u1")[0]?.text).toBe("Revisar la base legal");
    expect(store.listFor("u2")).toHaveLength(1);
    expect(store.listFor("u3")).toHaveLength(0);
  });

  it("filtra por caso", () => {
    const store = NoteStore.empty();
    store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "a" });
    store.add({ caseId: "case_000035", userId: "u1", userName: "Ana", text: "b" });
    expect(store.listFor("u1", "case_000034")).toHaveLength(1);
    expect(store.listFor("u1")).toHaveLength(2);
  });

  it("valida el texto", () => {
    const store = NoteStore.empty();
    expect(() =>
      store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "   " }),
    ).toThrow(NoteError);
    expect(() =>
      store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "x".repeat(4001) }),
    ).toThrow("4000");
    expect(() =>
      store.add({ caseId: "malformado", userId: "u1", userName: "Ana", text: "hola" }),
    ).toThrow("Caso no válido");
  });

  it("solo el autor puede borrar", () => {
    const store = NoteStore.empty();
    const note = store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "hola" });
    expect(() => store.remove(note.id, "u2")).toThrow("autor");
    store.remove(note.id, "u1");
    expect(store.listFor("u1")).toHaveLength(0);
  });

  it("persiste y recarga", async () => {
    const store = NoteStore.empty();
    store.add({ caseId: "case_000034", userId: "u1", userName: "Ana", text: "persistente" });
    await store.save(filePath, "case_000034");
    const reloaded = await NoteStore.load(filePath);
    expect(reloaded.listFor("u1")).toHaveLength(1);
    expect(await NoteStore.load(path.join(tmp, "no.json"))).toBeTruthy();
  });
});
