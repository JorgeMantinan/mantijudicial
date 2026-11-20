/** Tanda de escritos en paralelo (prioridad: casos con más huecos). */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const casosDir = path.join(raiz, "cases");
const paralelos = Number(process.argv.find((a) => a.startsWith("--paralelos="))?.split("=")[1] ?? 6);
const ejecutar = process.argv.includes("--ejecutar");
const PRIORITARIOS = ["case_000001","case_000009","case_000020","case_000023","case_000031","case_000035","case_000052","case_000053","case_000059","case_000070"];

const nombres = fs.readdirSync(casosDir).filter((n) => /^case_\d{6}$/.test(n)).filter((n) => n !== "case_000056");
const pendientes = nombres.filter((n) => !fs.existsSync(path.join(casosDir, n, "structured", "escrito.json")));
const orden = [...PRIORITARIOS.filter((n) => pendientes.includes(n)), ...pendientes.filter((n) => !PRIORITARIOS.includes(n))];

console.log(`Escritos pendientes: ${orden.length} (paralelos=${paralelos})${ejecutar ? "" : " → DRY-RUN, falta --ejecutar"}`);
if (!ejecutar) process.exit(0);

const tsx = path.join(raiz, "node_modules", "tsx", "dist", "cli.mjs");
let i = 0, ok = 0, fallos = 0, fallosSeguidos = 0, activos = 0, fin = false;
const fallidos = [];

function lanzar() {
  if (fin) return;
  if (i >= orden.length && activos === 0) {
    const detalle = fallidos.length > 0 ? ` → fallidos: ${fallidos.join(", ")}` : "";
    console.log(`FIN ok=${ok} fallos=${fallos}${detalle}`);
    process.exit(fallos >= 5 ? 2 : 0);
  }
  while (!fin && activos < paralelos && i < orden.length) {
    const caseId = orden[i++];
    activos++;
    execFile(process.execPath, [tsx, path.join(raiz, "pipeline", "15_escrito.ts"), `--a=${caseId}`], { cwd: raiz, windowsHide: true, timeout: 600000 }, (err, stdout) => {
      activos--;
      if (err) {
        fallos++;
        fallosSeguidos++;
        fallidos.push(caseId);
        console.log(`${caseId}: FALLO ${String(err).slice(0, 100)}`);
        if (fallosSeguidos >= 5) { fin = true; console.log("5 fallos seguidos: cuota agotada. Paro."); }
      } else {
        fallosSeguidos = 0; ok++;
        console.log(`[${ok}/${orden.length}] ${caseId}: ${String(stdout).trim().split("\n").pop()}`);
      }
      lanzar();
    });
  }
}
lanzar();
