import { describe, expect, it } from "vitest";
import { decodeEntities, innerToText, parseIndiceJson, parseTextoXml } from "./boe_xml.js";

const FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<response>
  <status><code>200</code><text>ok</text></status>
  <data>
    <texto>
      <bloque id="a1" tipo="articulo">
        <version id_norma="BOE-A-1" fecha_publicacion="18890725" fecha_vigencia="18890816">
          <p class="parrafo">Versión antigua &amp; obsoleta.</p>
        </version>
        <version id_norma="BOE-A-1" fecha_publicacion="18890725" fecha_vigencia="20000101">
          <p class="parrafo">1. Primera línea.</p>
          <p class="parrafo">2. Segunda línea &lt;detalle&gt; &#241;.</p>
        </version>
      </bloque>
      <bloque id="tp" tipo="encabezado">
        <version id_norma="BOE-A-1" fecha_publicacion="18890725" fecha_vigencia="18890816">
          <p class="parrafo">Título preliminar</p>
        </version>
      </bloque>
      <bloque id="futuro" tipo="articulo">
        <version id_norma="BOE-A-1" fecha_publicacion="20990101" fecha_vigencia="20990101">
          <p class="parrafo">Aún no vigente</p>
        </version>
      </bloque>
    </texto>
  </data>
</response>`;

describe("decodeEntities", () => {
  it("resuelve entidades nombradas, numéricas y dobles", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &#241; &#xF1; &quot;x&quot;")).toBe(
      'a & b <c> ñ ñ "x"',
    );
    expect(decodeEntities("&amp;lt;")).toBe("&lt;");
  });
});

describe("innerToText", () => {
  it("quita etiquetas y respeta párrafos", () => {
    const text = innerToText('<p class="parrafo">Uno</p><p>Dos <b>negrita</b></p>');
    expect(text).toBe("Uno\nDos negrita");
  });
});

describe("parseTextoXml", () => {
  const blocks = parseTextoXml(FIXTURE, "20260930");

  it("extrae id y tipo de cada bloque", () => {
    expect(blocks.map((block) => block.id)).toEqual(["a1", "tp", "futuro"]);
    expect(blocks.map((block) => block.tipo)).toEqual(["articulo", "encabezado", "articulo"]);
  });

  it("elige la versión vigente más reciente", () => {
    const article = blocks[0]!;
    expect(article.fecha_vigencia).toBe("20000101");
    expect(article.texto).toBe("1. Primera línea.\n2. Segunda línea <detalle> ñ.");
  });

  it("conserva todas las versiones, de la más antigua a la más reciente", () => {
    expect(blocks[0]!.versions.map((version) => version.fecha_vigencia)).toEqual([
      "18890816",
      "20000101",
    ]);
    expect(blocks[0]!.versions[0]!.texto).toContain("Versión antigua");
    expect(blocks[1]!.versions).toHaveLength(1);
  });

  it("mantiene la única versión cuando no hay cambio", () => {
    expect(blocks[1]!.texto).toBe("Título preliminar");
  });

  it("cae a la versión más antigua si ninguna está vigente", () => {
    expect(blocks[2]!.fecha_vigencia).toBe("20990101");
    expect(blocks[2]!.texto).toBe("Aún no vigente");
  });
});

describe("parseIndiceJson", () => {
  it("lee los títulos de bloques del índice", () => {
    const entries = parseIndiceJson({
      status: { code: "200", text: "ok" },
      data: [
        {
          bloque: [
            { id: "preambulo", titulo: "", fecha_actualizacion: "18890725" },
            { id: "a1", titulo: "Art 1", fecha_actualizacion: "18890725" },
          ],
        },
      ],
    });
    expect(entries).toEqual([
      { id: "preambulo", titulo: "", fecha_actualizacion: "18890725" },
      { id: "a1", titulo: "Art 1", fecha_actualizacion: "18890725" },
    ]);
  });
});
