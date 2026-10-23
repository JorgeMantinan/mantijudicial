/**
 * Tanda de tokens (instrucción de "a final de mes", docs/13): gasta los
 * tokens restantes en el orden acordado, avisando antes del coste.
 *
 *   node scripts/tanda-tokens.mjs                     → plan (dry-run, gratis)
 *   node scripts/tanda-tokens.mjs --ejecutar          → ejecuta el plan
 *   node scripts/tanda-tokens.mjs --ejecutar --max-casos=5
 *   node scripts/tanda-tokens.mjs --ejecutar --solo=vias
 *
 * Reglas: sin case_000056 (corrupto, decisión suya), sin re-enriquecer nada,
 * los CLI ya saltan lo que existe (resumible), y todo el gasto queda en
 * structured/*.json (analysis.cost) y en /eval.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const casosDir = path.join(raiz, "cases");
const EXCLUIDOS = new Set(["case_000056"]);

const args = process.argv.slice(2);
const ejecutar = args.includes("--ejecutar");
const argSolo = args.find((a) => a.startsWith("--solo="));
const solo = argSolo ? argSolo.split("=")[1] : "todo";
const argMax = args.find((a) => a.startsWith("--max-casos="));
const maxCasos = argMax ? Number(argMax.split("=")[1]) : 9999;

function estructurado(caseId) {
  return path.join(casosDir, caseId, "structured");
}

function enriquecido(caseId) {
  try {
    const review = JSON.parse(fs.readFileSync(path.join(estructurado(caseId), "review.json"), "utf8"));
    return review?.extraction?.validation === "OK";
  } catch {
    return false;
  }
}

function coste(caseId, fichero) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(estructurado(caseId), fichero), "utf8"));
    return Number(data?.analysis?.cost ?? 0);
  } catch {
    return 0;
  }
}

const nombres = fs
  .readdirSync(casosDir)
  .filter((n) => /^case_\d{6}$/.test(n))
  .filter((n) => !EXCLUIDOS.has(n))
  .sort();

const sinVias = nombres.filter((n) => !fs.existsSync(path.join(estructurado(n), "vias.json")));
const sinCompare = nombres.filter(
  (n) => enriquecido(n) && !fs.readdirSync(estructurado(n)).some((f) => /^compare_.*\.json$/.test(f)),
);

const planVias = sinVias.slice(0, maxCasos);
const planCompare = sinCompare.slice(0, maxCasos);
if (process.env.DEBUG_TANDA) {
  console.log("[dbg] raiz", raiz, "nombres", nombres.length, "sinVias", sinVias.length, "sinCompare", sinCompare.length);
}

console.log("Plan de tanda (orden de docs/13):");
console.log(`  1. comparaciones: ${planCompare.length} casos ≈ $${(planCompare.length * 0.003).toFixed(2)}`);
console.log(`  2. vías:          ${planVias.length} casos ≈ $${(planVias.length * 0.003).toFixed(2)}`);
console.log(`  3. re-enriquecer: NO (política)`);
console.log(`  4. case_000056:   excluido`);
if (!ejecutar) {
  console.log("\nDRY-RUN (nada gastado). Para ejecutar: --ejecutar");
  process.exit(0);
}

function tsxCli(script, cliArgs) {
  const tsx = path.join(raiz, "node_modules", "tsx", "dist", "cli.mjs");
  const salida = execFileSync(process.execPath, [tsx, path.join(raiz, "pipeline", script), ...cliArgs], {
    cwd: raiz,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  return salida;
}

let gastado = 0;
if (solo !== "vias") {
  console.log(`\n--- Comparaciones (${planCompare.length}) ---`);
  for (const [i, caseId] of planCompare.entries()) {
    try {
      const out = tsxCli("14_compare.ts", [`--a=${caseId}`]);
      console.log(`[${i + 1}/${planCompare.length}] ${caseId}: ${out.trim().split("\n").pop()}`);
    } catch (error) {
      console.log(`[${i + 1}/${planCompare.length}] ${caseId}: FALLO ${String(error).slice(0, 120)}`);
    }
    const ficheros = fs.readdirSync(estructurado(caseId)).filter((f) => /^compare_.*\.json$/.test(f));
    for (const f of ficheros) gastado += coste(caseId, f);
  }
}
if (solo !== "compare") {
  console.log(`\n--- Vías (${planVias.length}, tandas de 10) ---`);
  for (let i = 0; i < planVias.length; i += 10) {
    const lote = planVias.slice(i, i + 10);
    try {
      tsxCli("10_vias.ts", [`--cases=${lote.join(",")}`]);
      console.log(`[${Math.min(i + 10, planVias.length)}/${planVias.length}] lote ${lote[0]}…${lote[lote.length - 1]} ok`);
    } catch (error) {
      console.log(`lote ${lote[0]}… FALLO ${String(error).slice(0, 120)}`);
    }
  }
  for (const caseId of planVias) gastado += coste(caseId, "vias.json");
}

console.log(`\nGasto registrado en esta tanda (analysis.cost de los JSON): $${gastado.toFixed(4)}`);
console.log("Detalle: /eval → Coste en vivo, o pnpm eval:show");
