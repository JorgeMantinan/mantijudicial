import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateSecret, otpauthUri, totp, verifyTotp } from "./totp.js";

const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("base32", () => {
  it("codifica y descodifica", () => {
    const buffer = Buffer.from("hola mundo");
    expect(base32Decode(base32Encode(buffer)).toString("ascii")).toBe("hola mundo");
    expect(base32Encode(Buffer.from("12345678901234567890", "ascii"))).toBe(
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    );
  });

  it("genera secretos de 32 caracteres", () => {
    expect(generateSecret()).toHaveLength(32);
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe("totp (RFC 6238)", () => {
  it("vector de prueba T=59s", () => {
    expect(totp(RFC_SECRET, 59 * 1000, 30, 8)).toBe("94287082");
  });

  it("vector de prueba T=1111111109s", () => {
    expect(totp(RFC_SECRET, 1111111109 * 1000, 30, 8)).toBe("07081804");
  });

  it("vector de prueba T=1234567890s", () => {
    expect(totp(RFC_SECRET, 1234567890 * 1000, 30, 8)).toBe("89005924");
  });

  it("verifica el código vigente y el de al lado", () => {
    const now = 1790000000000;
    const code = totp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, 1, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 30_000), 1, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 120_000), 1, now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", 1, now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", 1, now)).toBe(false);
  });
});

describe("otpauthUri", () => {
  it("construye la URI para la app de autenticación", () => {
    const uri = otpauthUri("GEZDGNBVGY3TQOJQ", "ana@despacho.es");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=GEZDGNBVGY3TQOJQ");
    expect(uri).toContain("ana%40despacho.es");
  });
});
