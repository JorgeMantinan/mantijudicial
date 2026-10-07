import { describe, expect, it } from "vitest";
import { leerBytes, leerJson } from "./api-body";

function peticion(cuerpo: string | null): Request {
  return new Request("http://localhost/api/prueba", {
    method: "POST",
    ...(cuerpo === null ? {} : { body: cuerpo }),
  });
}

describe("leerBytes", () => {
  it("devuelve el cuerpo completo si cabe en el tope", async () => {
    const bytes = await leerBytes(peticion("hola qué tal"), 1024);
    expect(bytes.toString("utf8")).toBe("hola qué tal");
  });

  it("sin cuerpo devuelve un buffer vacío", async () => {
    const bytes = await leerBytes(peticion(null), 1024);
    expect(bytes.length).toBe(0);
  });

  it("lanza si el cuerpo supera el tope", async () => {
    await expect(leerBytes(peticion("x".repeat(50)), 10)).rejects.toThrow(
      "Cuerpo demasiado grande",
    );
  });
});

describe("leerJson", () => {
  it("parsea un JSON válido", async () => {
    const cuerpo = JSON.stringify({ asunto: "nulidad de cláusula suelo", importe: 1500 });
    await expect(leerJson(peticion(cuerpo))).resolves.toEqual({
      asunto: "nulidad de cláusula suelo",
      importe: 1500,
    });
  });

  it("lanza con un cuerpo mayor de 2 MB", async () => {
    const gigante = JSON.stringify({ texto: "x".repeat(2 * 1024 * 1024) });
    await expect(leerJson(peticion(gigante))).rejects.toThrow("Cuerpo demasiado grande");
  });

  it("sin cuerpo, JSON.parse lanza", async () => {
    await expect(leerJson(peticion(null))).rejects.toThrow();
  });
});
