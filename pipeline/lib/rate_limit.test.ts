import { describe, expect, it } from "vitest";
import { RateLimiter, ipDe } from "./rate_limit.js";

describe("RateLimiter", () => {
  it("permite hasta el máximo y bloquea después", () => {
    const limiter = new RateLimiter({ maxIntentos: 3, ventanaMs: 60_000 });
    const ahora = 1_000_000;
    expect(limiter.intentar("k", ahora)).toBe(true);
    expect(limiter.intentar("k", ahora)).toBe(true);
    expect(limiter.intentar("k", ahora)).toBe(true);
    expect(limiter.intentar("k", ahora)).toBe(false);
    expect(limiter.intentar("k", ahora)).toBe(false);
  });

  it("las claves son independientes", () => {
    const limiter = new RateLimiter({ maxIntentos: 1, ventanaMs: 60_000 });
    expect(limiter.intentar("a", 1)).toBe(true);
    expect(limiter.intentar("a", 1)).toBe(false);
    expect(limiter.intentar("b", 1)).toBe(true);
  });

  it("reporta la espera del bloqueo y se levanta al caducar", () => {
    const limiter = new RateLimiter({ maxIntentos: 1, ventanaMs: 60_000 });
    const ahora = 500_000;
    limiter.intentar("k", ahora);
    expect(limiter.intentar("k", ahora)).toBe(false);
    expect(limiter.espera("k", ahora)).toBeGreaterThan(0);
    expect(limiter.espera("k", ahora + 61_000)).toBe(0);
    expect(limiter.intentar("k", ahora + 61_000)).toBe(true);
  });

  it("liberar reinicia el contador tras un éxito", () => {
    const limiter = new RateLimiter({ maxIntentos: 2, ventanaMs: 60_000 });
    limiter.intentar("k", 10);
    limiter.intentar("k", 10);
    expect(limiter.intentar("k", 10)).toBe(false);
    limiter.liberar("k");
    expect(limiter.intentar("k", 10)).toBe(true);
  });
});

describe("ipDe", () => {
  it("lee el último salto de x-forwarded-for (no el primero, que es spoofable)", () => {
    const conHeader = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(ipDe(conHeader)).toBe("5.6.7.8");
    expect(ipDe(new Request("http://x"))).toBe("local");
  });
});
