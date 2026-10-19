// Sprint de frases — verificación del golden set (cases/golden.json).
//
// El dueño no es abogado ni juez: este script hace la parte QUE SÍ ES
// MECANIZABLE sin criterio jurídico — contrastar cada entrada auto-rule
// contra tres evidencias independientes del propio corpus:
//   1. reglas del fallo sobre judgment.txt (detectOutcomeFromText),
//   2. outcome.json de la extracción (IA),
//   3. citas BOE exigidas presentes en el texto (boeIdsInText) + headline.
// Sólo con concordancia completa se propone (y con --aplicar se marca)
// confirmed=true. La verificación PROFUNDA (leer el fallo y juzgar si la
// rama/citas son jurídicamente correctas) la hace el agente durante el
// sprint siguiendo el skill `.opencode/skills/golden-set/SKILL.md`.
//
// Uso:
//   pnpm exec tsx pipeline/sprint_golden.ts             # propuesta (no escribe)
//   pnpm exec tsx pipeline/sprint_golden.ts --aplicar   # confirma las ALTA + backup
import fs from "node:fs";
import path from "node:path";
import { boeIdsInText, detectOutcomeFromText } from "./lib/eval.js";
import { CASES_DIR } from "./lib/paths.js";

interface Expect {
  cassation_outcome?: string;
  civil_branch?: string;
  headline_contains?: string;
  must_cite_boe_ids?: string[];
  min_holdings?: number;
  min_facts?: number;
}

interface Entrada {
  caseId: string;
  expect: Expect;
  source: string;
  confirmed: boolean;
  notes?: string;
}

interface Golden {
  version: number;
  entries: Entrada[];
}

const APLICAR = process.argv.includes("--aplicar");
const FECHA = new Date().toISOString().slice(0, 10);
const VERSION_GT = "golden-v1-agent";

const normalizar = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function leerJson<T>(ruta: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8")) as T;
  } catch {
    return null;
  }
}

const rutaGolden = path.join(CASES_DIR, "golden.json");
const golden = leerJson<Golden>(rutaGolden);
if (!golden?.entries) {
  console.error(`No se pudo leer ${rutaGolden}`);
  process.exit(1);
}
const porId = new Map(golden.entries.map((e) => [e.caseId, e]));

interface Fila {
  caso: string;
  veredicto: string;
  reglas: string;
  ia: string;
  expect: string;
  citas: string;
  headline: string;
  nota: string;
}

const filas: Fila[] = [];

for (const caso of fs.readdirSync(CASES_DIR).filter((n) => /^case_\d{6}$/.test(n)).sort()) {
  const textoPath = path.join(CASES_DIR, caso, "extracted", "judgment.txt");
  const texto = fs.existsSync(textoPath) ? fs.readFileSync(textoPath, "utf8") : "";
  const entrada = porId.get(caso) ?? null;
  const expect = entrada?.expect ?? {};
  const outcome = leerJson<{ outcome?: { cassation_outcome?: string } }>(
    path.join(CASES_DIR, caso, "structured", "outcome.json"),
  );
  const ia = (outcome?.outcome?.cassation_outcome ?? "SIN_OUTCOME").trim().toUpperCase();
  const reglas = texto ? detectOutcomeFromText(texto) : "SIN_TEXTO";
  const citesEnTexto = new Set(texto ? boeIdsInText(texto) : []);
  const exigidas = expect.must_cite_boe_ids ?? [];
  const citasFaltan = exigidas.filter((id) => !citesEnTexto.has(id));
  const citasOk = citasFaltan.length === 0;
  const headlineOk =
    !expect.headline_contains || (texto.length > 0 && normalizar(texto).includes(normalizar(expect.headline_contains)));

  let veredicto: string;
  let nota = "";
  if (!entrada) {
    if (texto && reglas !== "UNKNOWN" && ia === reglas) {
      veredicto = "ALTA-sin-entrada";
      nota = "Candidata a crearse: reglas e IA concordantes.";
    } else {
      veredicto = "SIN-ENTRADA";
      nota = "Sin expect en golden.json.";
    }
  } else if (!texto) {
    veredicto = "SIN-TEXTO";
    nota = "No hay judgment.txt que verificar.";
  } else if (reglas === "UNKNOWN") {
    veredicto = "BAJA";
    nota = "Las reglas no detectan fallo en el texto.";
  } else if (expect.cassation_outcome && expect.cassation_outcome.toUpperCase() !== reglas) {
    veredicto = "BAJA";
    nota = `expect(${expect.cassation_outcome}) ≠ reglas(${reglas}).`;
  } else if (ia !== "SIN_OUTCOME" && ia !== reglas) {
    veredicto = "MEDIA";
    nota = `outcome.json(${ia}) ≠ reglas(${reglas}): revisar a fondo en el sprint.`;
  } else if (!citasOk) {
    veredicto = "MEDIA";
    nota = `Faltan BOE ids en el texto: ${citasFaltan.join(", ")}.`;
  } else if (!headlineOk) {
    veredicto = "MEDIA";
    nota = "headline_contains no aparece en judgment.txt.";
  } else {
    veredicto = "ALTA";
    nota = "Reglas, IA y citas concordantes con el texto.";
  }

  filas.push({
    caso,
    veredicto,
    reglas,
    ia,
    expect: expect.cassation_outcome ?? "—",
    citas: exigidas.length === 0 ? "—" : `${exigidas.length - citasFaltan.length}/${exigidas.length}`,
    headline: expect.headline_contains ? (headlineOk ? "ok" : "NO") : "—",
    nota,
  });
}

// ---------------------------------------------------------------- aplicar
let aplicadas = 0;
let creadas = 0;
if (APLICAR) {
  fs.copyFileSync(rutaGolden, `${rutaGolden}.bak-${FECHA}`);
  const ahora = new Date().toISOString();
  for (const fila of filas) {
    if (fila.veredicto === "ALTA") {
      const entrada = porId.get(fila.caso)!;
      entrada.confirmed = true;
      entrada.notes =
        `Verificado por sprint_golden v1 (${FECHA}): reglas de fallo, outcome.json ` +
        "y citas BOE concordantes con judgment.txt. Verificación profunda (fallo a lectura) pendiente en el sprint.";
      aplicadas += 1;
      marcarReview(fila.caso, ahora);
    } else if (fila.veredicto === "ALTA-sin-entrada") {
      const texto = fs.readFileSync(path.join(CASES_DIR, fila.caso, "extracted", "judgment.txt"), "utf8");
      const nuevos = [...new Set(boeIdsInText(texto))].sort();
      golden.entries.push({
        caseId: fila.caso,
        expect: { cassation_outcome: fila.reglas, ...(nuevos.length > 0 ? { must_cite_boe_ids: nuevos } : {}) },
        source: "auto-rule",
        confirmed: true,
        notes:
          `Creada y verificada por sprint_golden v1 (${FECHA}): outcome detectado por reglas ` +
          "y concordante con outcome.json; BOE ids presentes en el texto.",
      });
      creadas += 1;
      marcarReview(fila.caso, ahora);
    }
  }
  golden.entries.sort((a, b) => a.caseId.localeCompare(b.caseId));
  fs.writeFileSync(rutaGolden, `${JSON.stringify(golden, null, 2)}\n`, "utf8");
}

function marcarReview(caso: string, ahora: string): void {
  const ruta = path.join(CASES_DIR, caso, "structured", "review.json");
  const review = leerJson<Record<string, any>>(ruta);
  if (!review) {
    return;
  }
  fs.copyFileSync(ruta, `${ruta}.bak-${FECHA}`);
  review.golden = {
    isGoldenDataset: true,
    groundTruthVersion: VERSION_GT,
    reviewedBy: "sprint_golden",
    reviewedAt: ahora,
  };
  fs.writeFileSync(ruta, `${JSON.stringify(review, null, 2)}\n`, "utf8");
}

// ------------------------------------------------------------------ salida
const cuenta = (prefijo: string) => filas.filter((f) => f.veredicto.startsWith(prefijo)).length;
const resumen = {
  casos: filas.length,
  alta: cuenta("ALTA"),
  altaSinEntrada: cuenta("ALTA-sin-entrada"),
  media: cuenta("MEDIA"),
  baja: cuenta("BAJA"),
  sinEntrada: cuenta("SIN-ENTRADA"),
  sinTexto: cuenta("SIN-TEXTO"),
  aplicadas,
  creadas,
};

const md = [
  "# Golden set — verificación mecánica (sprint_golden v1)",
  "",
  `> Generado el ${FECHA} por \`pipeline/sprint_golden.ts\` (${APLICAR ? "APLICADO" : "propuesta"}).`,
  "> Criterio: sólo se confirman entradas con reglas de fallo, outcome.json y citas",
  "> BOE concordantes con `judgment.txt`. La verificación jurídica profunda (leer el",
  "> fallo y juzgar rama/citas) la hace el agente en el sprint:",
  "> `.opencode/skills/golden-set/SKILL.md`.",
  "",
  "## Resumen",
  "",
  `- Casos: ${resumen.casos} · ALTA confirmadas: ${resumen.alta} · ALTA sin entrada (creadas): ${resumen.altaSinEntrada}`,
  `- MEDIA (revisión profunda en el sprint): ${resumen.media} · BAJA: ${resumen.baja} · sin entrada: ${resumen.sinEntrada} · sin texto: ${resumen.sinTexto}`,
  APLICAR
    ? `- Aplicado: ${resumen.alta} confirmadas + ${resumen.creadas} creadas. Backups: \`cases/golden.json.bak-${FECHA}\` y \`structured/review.json.bak-${FECHA}\`.`
    : "- Ejecuta `pnpm exec tsx pipeline/sprint_golden.ts --aplicar` para confirmar las ALTA.",
  "",
  "| caso | veredicto | expect | ia | reglas | citas | headline | nota |",
  "|---|---|---|---|---|---|---|---|",
  ...filas.map((f) => `| ${f.caso} | ${f.veredicto} | ${f.expect} | ${f.ia} | ${f.reglas} | ${f.citas} | ${f.headline} | ${f.nota} |`),
  "",
];

const salidaMd = path.join(CASES_DIR, "..", "docs", "sprint", "GOLDEN_SET.md");
fs.mkdirSync(path.dirname(salidaMd), { recursive: true });
fs.writeFileSync(salidaMd, md.join("\n"), "utf8");

console.log(JSON.stringify(resumen, null, 2));
console.error(`Informe: ${path.normalize(salidaMd)}`);
