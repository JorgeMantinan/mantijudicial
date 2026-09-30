import { describe, expect, it } from "vitest";
import { spanishNumberToInt } from "./spanish_number.js";

describe("spanishNumberToInt", () => {
  it("lee ordinales usados como cardinales", () => {
    expect(spanishNumberToInt("primero")).toBe(1);
    expect(spanishNumberToInt("segundo")).toBe(2);
    expect(spanishNumberToInt("décimo")).toBe(10);
  });

  it("lee unidades y teen numbers", () => {
    expect(spanishNumberToInt("tres")).toBe(3);
    expect(spanishNumberToInt("quince")).toBe(15);
    expect(spanishNumberToInt("dieciséis")).toBe(16);
    expect(spanishNumberToInt("veintidós")).toBe(22);
  });

  it("lee decenas con y", () => {
    expect(spanishNumberToInt("treinta")).toBe(30);
    expect(spanishNumberToInt("treinta y uno")).toBe(31);
    expect(spanishNumberToInt("setenta y cinco")).toBe(75);
  });

  it("lee números concatenados (ids del BOE)", () => {
    expect(spanishNumberToInt("treintayuno")).toBe(31);
    expect(spanishNumberToInt("dieciseis")).toBe(16);
    expect(spanishNumberToInt("veintidoster")).toBe(22);
  });

  it("lee centenas y millares", () => {
    expect(spanishNumberToInt("ciento quince")).toBe(115);
    expect(spanishNumberToInt("doscientos quince")).toBe(215);
    expect(spanishNumberToInt("mil")).toBe(1000);
    expect(spanishNumberToInt("dos mil trescientos quince")).toBe(2315);
  });

  it("devuelve null cuando no es un número", () => {
    expect(spanishNumberToInt("disposición adicional")).toBeNull();
    expect(spanishNumberToInt("")).toBeNull();
    expect(spanishNumberToInt("bis")).toBeNull();
  });
});
