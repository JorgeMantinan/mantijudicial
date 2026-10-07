#!/usr/bin/env node
/**
 * Crea un corpus mínimo de juguete para que `next build` funcione en CI.
 *
 * En un runner limpio no existen `cases/` ni `laws/` (viven en la rama
 * `data`), y `repoRoot()` fallaría sin una carpeta `cases/` que encontrar.
 * Este script levanta la estructura mínima que la web lee durante el build;
 * NO toca el corpus real: la raíz la elige quien lo invoca (en CI, un
 * directorio temporal al que después apunta `MANTIJUDICIAL_ROOT`).
 *
 * Uso: node scripts/crear-corpus-juguete.mjs <directorio-raíz>
 */
import fs from "node:fs";
import path from "node:path";

const raiz = process.argv[2];
if (!raiz) {
  console.error("Uso: node scripts/crear-corpus-juguete.mjs <directorio-raíz>");
  process.exit(1);
}

const raizAbs = path.resolve(raiz);
const caso = path.join(raizAbs, "cases", "case_000001");
const structured = path.join(caso, "structured");

fs.mkdirSync(path.join(caso, "original"), { recursive: true });
fs.mkdirSync(structured, { recursive: true });
fs.mkdirSync(path.join(raizAbs, "laws"), { recursive: true });

const ahora = new Date().toISOString();
function escribir(ruta, datos) {
  fs.writeFileSync(ruta, `${JSON.stringify(datos, null, 2)}\n`, "utf8");
}

escribir(path.join(structured, "summary.json"), {
  case_id: "case_000001",
  summary: {
    headline: "Caso de juguete para el build de CI",
    summary:
      "Sentencia mínima de prueba. El build solo necesita que los ficheros de structured/ existan y sean JSON válidos.",
    key_points: ["Datos de prueba", "Sin casos reales en CI"],
    missing_information: [],
  },
});

escribir(path.join(structured, "classification.json"), {
  case_id: "case_000001",
  classification: {
    civil_branch: "OTHER",
    subtopic: "corpus de juguete",
    finality_status: "UNKNOWN",
  },
});

escribir(path.join(structured, "outcome.json"), {
  case_id: "case_000001",
  outcome: {
    cassation_outcome: "UNKNOWN",
    recurring_side: "UNKNOWN",
    decisions: [],
    claim_outcomes: [],
    reasoning_summary: "UNKNOWN",
  },
});

escribir(path.join(structured, "review.json"), {
  case_id: "case_000001",
  extraction: {
    provider: "ci",
    model: "juguete",
    prompt_version: "enrich-v1",
    generated_at: ahora,
    input_chars: 0,
    tokens: null,
    cost: null,
    validation: "OK",
    schema_errors: [],
  },
  review: {
    status: "REVIEWED",
    reviewed_by: "ci",
    reviewed_at: ahora,
    notes: "corpus de juguete para compilar en CI",
  },
  golden: {
    isGoldenDataset: false,
    groundTruthVersion: null,
    reviewedBy: null,
    reviewedAt: null,
  },
});

// PDF de mentira: el build solo necesita que la ruta exista.
fs.writeFileSync(path.join(caso, "original", "x.pdf"), "%PDF-1.4\n% juguete de CI\n%%EOF\n", "utf8");

escribir(path.join(raizAbs, "laws", "index.json"), { norms: [] });

console.log(`Corpus de juguete creado en ${raizAbs}`);
