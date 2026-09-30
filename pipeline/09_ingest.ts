import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { looksLikePdf, nextCaseId, parseIngestArgs, sanitizePdfName } from "./lib/ingest.js";
import { CASES_DIR, REPO_ROOT } from "./lib/paths.js";
import { caseMetadataSchema } from "./lib/schema.js";

const TSX_CLI = path.join(REPO_ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function runStep(label: string, script: string, args: string[] = []): Promise<void> {
  process.stdout.write(`\n[>] ${label}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [TSX_CLI, path.join(REPO_ROOT, "pipeline", script), ...args],
      { cwd: REPO_ROOT, stdio: "inherit", windowsHide: true },
    );
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} terminó con código ${code}`));
    });
  });
}

async function isPdf(filePath: string): Promise<boolean> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(5);
    await handle.read(buffer, 0, 5, 0);
    return looksLikePdf(buffer);
  } finally {
    await handle.close();
  }
}

async function listCaseDirs(): Promise<string[]> {
  const names = await fs.readdir(CASES_DIR).catch(() => [] as string[]);
  return names.filter((name) => /^case_\d{6}$/.test(name));
}

async function patchMetadata(caseId: string, source: string): Promise<void> {
  const metadataDir = path.join(CASES_DIR, caseId, "metadata");
  const names = await fs.readdir(metadataDir).catch(() => [] as string[]);
  const fileName = names.find((name) => name.endsWith(".json")) ?? "case.json";
  const filePath = path.join(metadataDir, fileName);
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    const parsed = caseMetadataSchema.safeParse(raw);
    if (!parsed.success) return;
    const metadata = parsed.data;
    metadata.source_type = "UPLOAD";
    metadata.source = source;
    metadata.retrieval_date = new Date().toISOString().slice(0, 10);
    metadata.retrieved_by = "pipeline/09_ingest";
    metadata.usage_context = "lawyer-uploaded case, pending human review";
    await fs.writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    process.stdout.write(`metadata: source_type=UPLOAD source=${source}\n`);
  } catch {
    process.stdout.write("metadata: no se pudo actualizar (se generará en la siguiente higiene)\n");
  }
}

async function main(): Promise<void> {
  const args = parseIngestArgs(process.argv.slice(2));
  if (!args.file) {
    process.stderr.write(
      "Uso: pnpm ingest -- --file=/ruta/sentencia.pdf [--id=case_000081] [--source=DESPACHO] [--skip-enrich] [--no-refresh]\n",
    );
    process.exitCode = 1;
    return;
  }

  const pdfPath = path.resolve(args.file);
  const stat = await fs.stat(pdfPath).catch(() => null);
  if (!stat?.isFile()) {
    process.stderr.write(`No existe el fichero: ${pdfPath}\n`);
    process.exitCode = 1;
    return;
  }
  if (!(await isPdf(pdfPath))) {
    process.stderr.write(`No parece un PDF (falta la cabecera %PDF): ${pdfPath}\n`);
    process.exitCode = 1;
    return;
  }

  const existing = await listCaseDirs();
  const caseId = args.id ?? nextCaseId(existing);
  if (existing.includes(caseId)) {
    process.stderr.write(`El caso ${caseId} ya existe. Usa otro --id.\n`);
    process.exitCode = 1;
    return;
  }

  const originalDir = path.join(CASES_DIR, caseId, "original");
  await fs.mkdir(originalDir, { recursive: true });
  const targetName = sanitizePdfName(path.basename(pdfPath));
  await fs.copyFile(pdfPath, path.join(originalDir, targetName));

  process.stdout.write(`Ingesta: ${pdfPath}\n`);
  process.stdout.write(`Caso: ${caseId} (original/${targetName})\n`);

  await runStep("Higiene (genera metadata y manifiesto)", "01_hygiene.ts");
  await runStep("Extracción de texto", "02_extract.ts");

  const quality = await fs
    .readFile(path.join(CASES_DIR, caseId, "extracted", "quality.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { hasText?: boolean; reason?: string | null })
    .catch(() => null);
  if (quality && quality.hasText === false) {
    const reason = quality.reason ?? "el PDF no contiene texto";
    process.stdout.write(`\n[!] ${reason}\n`);
    throw new Error(
      `${caseId}: el PDF no se puede analizar todavía (${reason}). No se consume IA.`,
    );
  }

  await runStep("Metadata determinista", "03_metadata.ts");
  await patchMetadata(caseId, args.source);

  if (args.skipEnrich) {
    process.stdout.write("\n[>] Enriquecimiento IA omitido (--skip-enrich)\n");
  } else {
    await runStep("Enriquecimiento IA (1 llamada)", "04_enrich.ts", [`--cases=${caseId}`]);
  }

  if (args.refresh) {
    await runStep("Refresco de manifiesto", "01_hygiene.ts");
    await runStep("Suplemento de citas (reglas)", "13_supplement.ts");
    await runStep("Cruce de citas con el BOE", "06_match.ts");
    await runStep("Patrones del corpus", "07_patterns.ts");
  }

  process.stdout.write(`\n== INGESTA COMPLETADA ==\n`);
  process.stdout.write(`Caso: ${caseId}\n`);
  process.stdout.write(`Ver en la web: /cases/${caseId}\n`);
  if (!args.skipEnrich) {
    process.stdout.write(
      `Búsqueda: pnpm exec tsx pipeline/08_search.ts "consulta" --kind=case\n`,
    );
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
