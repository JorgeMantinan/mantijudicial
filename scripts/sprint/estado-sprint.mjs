// Estado del sprint de frases: resume el corpus y regenera
// docs/sprint/PROGRESO.md (tabla de hechos; no editar a mano).
// Uso: node scripts/sprint/estado-sprint.mjs [--sin escribir]
// Raíz del corpus: MANTIJUDICIAL_ROOT o la raíz del repo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = process.env.MANTIJUDICIAL_ROOT
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CASES = path.join(RAIZ, "cases");
const SALIDA = path.join(RAIZ, "docs", "sprint", "PROGRESO.md");
const SOLO_LEER = process.argv.includes("--sin-escribir");

function leerJson(ruta) {
  try {
    return JSON.parse(fs.readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
}

const casos = fs.existsSync(CASES)
  ? fs.readdirSync(CASES).filter((n) => /^case_\d+$/.test(n)).sort()
  : [];

const filas = [];
let conStructured = 0;
let conFrases = 0;
let conReview = 0;
let goldenFlag = 0;
let goldenConfirmadas = 0;
let revisados = 0;
let tokensTotales = 0;
const porPrompt = new Map();

// Golden real: cases/golden.json (confirmed), no el flag de review.json.
const goldenJson = leerJson(path.join(CASES, "golden.json"));
const goldenPorId = new Map((goldenJson?.entries ?? []).map((e) => [e.caseId, e]));

for (const caso of casos) {
  const dir = path.join(CASES, caso);
  const structured = path.join(dir, "structured");
  const hayStructured = fs.existsSync(structured);
  const review = leerJson(path.join(structured, "review.json"));
  const frases = leerJson(path.join(structured, "frases_candidatas.json"));
  if (hayStructured) conStructured++;
  const nFrases = Array.isArray(frases?.frases) ? frases.frases.length : 0;
  if (nFrases > 0) conFrases++;
  if (review) conReview++;
  if (review?.golden?.isGoldenDataset) goldenFlag++;
  const entradaGolden = goldenPorId.get(caso);
  const confirmada = entradaGolden?.confirmed === true;
  if (confirmada) goldenConfirmadas++;
  if (review?.review?.status === "REVIEWED") revisados++;
  tokensTotales += review?.extraction?.tokens?.total ?? 0;
  const prompt = review?.extraction?.prompt_version ?? "—";
  porPrompt.set(prompt, (porPrompt.get(prompt) ?? 0) + 1);
  filas.push({
    caso,
    structured: hayStructured ? "si" : "NO",
    prompt,
    estado: review?.review?.status ?? "sin review.json",
    golden: confirmada ? "si" : entradaGolden ? "auto" : "",
    frases: nFrases || "",
    tokens: review?.extraction?.tokens?.total ?? "",
  });
}

const dependencias = [
  ["pnpm", "pnpm-lock.yaml"],
  ["cases/", "cases"],
  ["laws/", "laws"],
].map(([nombre, rel]) => `${nombre} ${fs.existsSync(path.join(RAIZ, rel)) ? "ok" : "FALTA"}`);

const resumen = {
  casos: casos.length,
  conStructured,
  conReview,
  goldenConfirmadas,
  goldenAuto: (goldenJson?.entries ?? []).length - goldenConfirmadas,
  goldenFlagReviewJson: goldenFlag,
  revisados,
  conFrases,
  tokensTotales,
  porPrompt: Object.fromEntries(porPrompt),
};

const hoy = new Date().toISOString().slice(0, 10);
const md = [
  "# Progreso del sprint de frases (generado)",
  "",
  `> Generado por \`scripts/sprint/estado-sprint.mjs\` el ${hoy}. NO editar a mano:`,
  "> se regenera en cada pasada del sprint.",
  "",
  "## Resumen",
  "",
  `- Casos: **${casos.length}** · con structured/: **${conStructured}** · con review.json: **${conReview}` +
    `** · REVIEWED: **${revisados}**`,
  `- Golden (cases/golden.json): **${goldenConfirmadas} confirmadas** / ` +
    `${(goldenJson?.entries ?? []).length} entradas (flags review.json: ${goldenFlag})`,
  `- Con frases_candidatas.json: **${conFrases}/${casos.length}**`,
  `- Tokens históricos (suma de extraction.tokens.total): **${tokensTotales.toLocaleString("es-ES")}**`,
  `- Prompts: ${Object.entries(porPrompt).map(([k, v]) => `${k}×${v}`).join(", ")}`,
  `- Entorno: ${dependencias.join(" · ")}`,
  "",
  "## Tabla por caso",
  "",
  "| caso | structured | prompt | review | golden | frases | tokens |",
  "|---|---|---|---|---|---|---|",
  ...filas.map(
    (f) => `| ${f.caso} | ${f.structured} | ${f.prompt} | ${f.estado} | ${f.golden} | ${f.frases} | ${f.tokens} |`,
  ),
  "",
];

if (!SOLO_LEER) {
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, md.join("\n"), "utf8");
}

console.log(JSON.stringify({ raiz: RAIZ, ...resumen, escritura: SOLO_LEER ? "no" : SALIDA }, null, 2));
const listo = casos.length > 0 && conStructured === casos.length;
console.error(listo ? "LISTO: el sprint puede arrancar." : "REVISAR: hay casos sin structured/ o sin corpus.");
