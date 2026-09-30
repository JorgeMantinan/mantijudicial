import fs from "node:fs/promises";
import path from "node:path";
import { createAIProvider, type AIProvider } from "./lib/ai_provider.js";
import { extractJson } from "./lib/json_extract.js";
import { REPO_ROOT, caseDir } from "./lib/paths.js";
import {
  ESCRITO_PROMPT_VERSION,
  buildEscritoPrompt,
  escritoSchema,
  normalizeEscritoInput,
  renderEscritoContext,
  type EscritoReport,
} from "./lib/escrito.js";
import { loadLeyesForCase, loadSignals, pickSimilares } from "./lib/signals.js";

const DEFAULT_MODEL = "opencode-go/mimo-v2.6-flash";
const TIPOS = ["RECURSO_CASACION", "ALEGACIONES", "OPOSICION"] as const;

interface Args {
  caseId: string;
  tipo: (typeof TIPOS)[number];
  model: string;
  force: boolean;
  retries: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { caseId: "", tipo: "RECURSO_CASACION", model: DEFAULT_MODEL, force: false, retries: 2 };
  for (const arg of argv) {
    const caseId = arg.match(/^--a=(.+)$/) ?? arg.match(/^--case=(.+)$/);
    const tipo = arg.match(/^--tipo=(.+)$/);
    const model = arg.match(/^--model=(.+)$/);
    const retries = arg.match(/^--retries=(\d+)$/);
    if (caseId?.[1]) args.caseId = caseId[1].trim();
    if (tipo?.[1]) args.tipo = tipo[1].trim().toUpperCase() as Args["tipo"];
    if (model?.[1]) args.model = model[1];
    if (retries?.[1]) args.retries = Number(retries[1]);
    if (arg === "--force") args.force = true;
    if (/^case_\d{6}$/.test(arg)) args.caseId = arg;
  }
  if (!TIPOS.includes(args.tipo)) {
    process.stderr.write(`Tipo desconocido: ${args.tipo} (valores: ${TIPOS.join(", ")})\n`);
    args.tipo = "RECURSO_CASACION";
  }
  return args;
}

export function renderEscritoText(report: EscritoReport): string {
  const lines: string[] = [];
  lines.push("BORRADOR DE ESCRITO (pendiente de revisión por un letrado)");
  lines.push("=".repeat(70));
  lines.push(`Tipo: ${report.tipo.replace(/_/g, " ")}`);
  lines.push(`Asunto: ${report.asunto}`);
  lines.push(`Caso: ${report.case_id}`);
  if (report.encabezado.tribunal) lines.push(`Tribunal: ${report.encabezado.tribunal}`);
  if (report.encabezado.numero_recurso) lines.push(`Recurso: ${report.encabezado.numero_recurso}`);
  if (report.encabezado.procurador || report.encabezado.letrado) {
    lines.push(
      `Representación: Procurador ${report.encabezado.procurador || "-"} | Letrado ${report.encabezado.letrado || "-"}`,
    );
  }
  lines.push("");
  for (const bloque of report.cuerpo) {
    lines.push(bloque.titulo.toUpperCase());
    lines.push("-".repeat(bloque.titulo.length));
    lines.push(bloque.texto.trim());
    lines.push("");
  }
  if (report.pedidos.length > 0) {
    lines.push("PEDIDOS");
    lines.push("-------");
    report.pedidos.forEach((pedido, index) => lines.push(`${index + 1}. ${pedido}`));
    lines.push("");
  }
  if (report.citas.length > 0) {
    lines.push("CITAS VERIFICADAS");
    lines.push("-----------------");
    for (const cita of report.citas) lines.push(`- "${cita.texto}" (${cita.fuente})`);
    lines.push("");
  }
  if (report.comprobar_antes.length > 0) {
    lines.push("COMPROBAR ANTES DE PRESENTAR");
    lines.push("----------------------------");
    for (const item of report.comprobar_antes) lines.push(`- ${item}`);
    lines.push("");
  }
  if (report.avisos.length > 0) {
    lines.push("AVISOS");
    lines.push("------");
    for (const item of report.avisos) lines.push(`- ${item}`);
  }
  return `${lines.join("\n")}\n`;
}

async function runEscrito(provider: AIProvider, args: Args): Promise<string> {
  const principal = await loadSignals(args.caseId);
  if (!principal) throw new Error(`${args.caseId}: sin extracción de IA`);
  const similares = await pickSimilares(args.caseId, 3);
  const leyes = await loadLeyesForCase(args.caseId);

  const context = renderEscritoContext({ principal, similares, leyes });
  const contextPath = path.join(caseDir(args.caseId), "extracted", "escrito_context.txt");
  await fs.mkdir(path.dirname(contextPath), { recursive: true });
  await fs.writeFile(contextPath, context, "utf8");

  const prompt = buildEscritoPrompt(args.caseId, args.tipo);
  let attempts = 0;
  let lastError = "";
  let lastRaw = "";

  while (attempts < args.retries + 1) {
    attempts += 1;
    let result: Awaited<ReturnType<AIProvider["run"]>>;
    try {
      result = await provider.run({
        prompt,
        files: [contextPath],
        model: args.model,
        timeoutMs: 900_000,
        cwd: REPO_ROOT,
      });
    } catch (error) {
      lastError = String(error);
      process.stdout.write(`  intento ${attempts}: fallo del proveedor IA\n`);
      continue;
    }
    lastRaw = result.text;
    try {
      const parsed = escritoSchema.safeParse(normalizeEscritoInput(extractJson(result.text)));
      if (parsed.success) {
        const report: EscritoReport = { ...parsed.data, case_id: args.caseId };
        const output = {
          case_id: args.caseId,
          analysis: {
            provider: provider.name,
            model: args.model,
            prompt_version: ESCRITO_PROMPT_VERSION,
            generated_at: new Date().toISOString(),
            context_chars: context.length,
            leyes: leyes.map((law) => law.boe_id),
            similares: similares.map((item) => item.id),
            tokens: result.tokens,
            cost: result.cost,
            attempts,
          },
          report,
        };
        const outPath = path.join(caseDir(args.caseId), "structured", "escrito.json");
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
        const txtPath = path.join(caseDir(args.caseId), "structured", "escrito.txt");
        await fs.writeFile(txtPath, renderEscritoText(report), "utf8");
        return `tipo=${report.tipo} bloques=${report.cuerpo.length} pedidos=${report.pedidos.length} citas=${report.citas.length} comprobar=${report.comprobar_antes.length} leyes=${leyes.length} similares=${similares.length} intentos=${attempts}`;
      }
      lastError = parsed.error.issues
        .slice(0, 4)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      process.stdout.write(`  intento ${attempts}: esquema incorrecto (${lastError})\n`);
    } catch (error) {
      lastError = String(error);
      process.stdout.write(`  intento ${attempts}: JSON ilegible\n`);
    }
  }

  const failedPath = path.join(caseDir(args.caseId), "structured", "escrito_failed.txt");
  await fs.mkdir(path.dirname(failedPath), { recursive: true });
  await fs.writeFile(failedPath, `${lastError}\n\n${lastRaw}`, "utf8");
  throw new Error(`fallo tras ${attempts} intentos (${lastError})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.caseId) {
    process.stderr.write(
      "Uso: pnpm escrito -- --a=case_000034 [--tipo=RECURSO_CASACION|ALEGACIONES|OPOSICION] [--force]\n",
    );
    process.exitCode = 1;
    return;
  }

  const outFile = path.join(caseDir(args.caseId), "structured", "escrito.json");
  const exists = await fs
    .stat(outFile)
    .then(() => true)
    .catch(() => false);
  if (exists && !args.force) {
    process.stdout.write(`Ya existe borrador para ${args.caseId} (usa --force para repetir)\n`);
    return;
  }

  const provider = createAIProvider();
  process.stdout.write(`Proveedor: ${provider.name} | Modelo: ${args.model}\n`);
  process.stdout.write(`Redactando borrador (${args.tipo}) para ${args.caseId}…\n`);
  const started = Date.now();
  const message = await runEscrito(provider, args);
  process.stdout.write(`OK (${Math.round((Date.now() - started) / 1000)}s) ${message}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
