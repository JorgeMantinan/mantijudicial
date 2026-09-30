import fs from "node:fs/promises";
import path from "node:path";
import { caseDir } from "./lib/paths.js";
import { buildManifest, saveManifest, scanCases } from "./lib/manifest.js";
import { caseMetadataSchema } from "./lib/schema.js";

const USAGE_CONTEXT = "non-commercial demo phase, <100 threshold";

interface GeneratedMetadata {
  case_id: string;
  source_type: string;
  source: string;
  source_url: string;
  roj: string;
  ecli: string;
  id_cendoj: string;
  court: string;
  court_hierarchy_level: string;
  seat: string;
  section: string;
  resolution_date: string;
  rapporteur: string;
  procedure_type: string;
  appeal_number: string;
  resolution_number: string;
  civil_branch: string;
  finality_status: string;
  retrieval_date: string;
  retrieved_by: string;
  usage_context: string;
  sha256: string;
  search_term_used: string;
}

function buildGeneratedMetadata(entry: Awaited<ReturnType<typeof scanCases>>[number]): GeneratedMetadata {
  const isSupreme = entry.pdf.court?.startsWith("Tribunal Supremo") ?? false;
  return {
    case_id: entry.caseId,
    source_type: "PUBLIC",
    source: "CENDOJ",
    source_url: "UNKNOWN",
    roj: entry.pdf.roj ?? "UNKNOWN",
    ecli: entry.pdf.ecli ?? "UNKNOWN",
    id_cendoj: "UNKNOWN",
    court: entry.pdf.court ?? "UNKNOWN",
    court_hierarchy_level: isSupreme ? "SUPREME_COURT" : "UNKNOWN",
    seat: "UNKNOWN",
    section: "UNKNOWN",
    resolution_date: "UNKNOWN",
    rapporteur: "UNKNOWN",
    procedure_type: "UNKNOWN",
    appeal_number: "UNKNOWN",
    resolution_number: "UNKNOWN",
    civil_branch: "UNKNOWN",
    finality_status: "UNKNOWN",
    retrieval_date: "UNKNOWN",
    retrieved_by: "UNKNOWN",
    usage_context: USAGE_CONTEXT,
    sha256: entry.pdf.sha256,
    search_term_used: "UNKNOWN",
  };
}

async function main(): Promise<void> {
  const entries = await scanCases();
  const alerts: string[] = [];
  let generated = 0;

  for (const entry of entries) {
    const metadataDir = path.join(caseDir(entry.caseDir), "metadata");

    if (entry.metadataFiles.length === 0) {
      const metadata = buildGeneratedMetadata(entry);
      const parsed = caseMetadataSchema.safeParse(metadata);
      if (!parsed.success) {
        alerts.push(`${entry.caseDir}: metadata generada no valida: ${parsed.error.message}`);
        continue;
      }
      await fs.mkdir(metadataDir, { recursive: true });
      await fs.writeFile(
        path.join(metadataDir, "case.json"),
        `${JSON.stringify(metadata, null, 2)}\n`,
        "utf8",
      );
      entry.metadataFiles = ["case.json"];
      generated += 1;
      continue;
    }

    for (const fileName of entry.metadataFiles) {
      const filePath = path.join(metadataDir, fileName);
      try {
        const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
        const parsed = caseMetadataSchema.safeParse(raw);
        if (!parsed.success) {
          alerts.push(
            `${entry.caseDir}/${fileName}: campos invalidos -> ${parsed.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")}`,
          );
        }
        const ecli = (raw as { ecli?: string }).ecli;
        if (ecli && entry.pdf.ecli && ecli !== entry.pdf.ecli) {
          alerts.push(
            `${entry.caseDir}/${fileName}: ecli metadata (${ecli}) != ecli pdf (${entry.pdf.ecli})`,
          );
        }
      } catch (error) {
        alerts.push(`${entry.caseDir}/${fileName}: JSON ilegible -> ${String(error)}`);
      }
    }

    if (entry.metadataFiles.length === 1 && entry.metadataFiles[0] !== "case.json") {
      alerts.push(
        `${entry.caseDir}: nombre de metadata no estandar "${entry.metadataFiles[0]}" (estandar: case.json)`,
      );
    }
  }

  for (const entry of entries) {
    if (entry.duplicateOf) {
      alerts.push(`${entry.caseDir}: duplicado de ${entry.duplicateOf} (mismo ECLI ${entry.pdf.ecli})`);
    }
    if (entry.pdf.ecli === null) {
      alerts.push(`${entry.caseDir}: sin ECLI en cabecera del PDF`);
    }
  }

  const manifest = buildManifest(entries);
  await saveManifest(manifest);

  const unique = new Set(entries.map((entry) => entry.pdf.ecli).filter(Boolean));
  const noMetadata = entries.filter((entry) => entry.metadataFiles.length === 0).length;
  const noEcli = entries.filter((entry) => !entry.pdf.ecli).length;

  process.stdout.write("== FASE A: HIGIENE DEL CORPUS ==\n");
  process.stdout.write(`Casos: ${manifest.totalCases}\n`);
  process.stdout.write(`Decisiones unicas (ECLI): ${unique.size}\n`);
  process.stdout.write(`Duplicados: ${manifest.duplicates}\n`);
  process.stdout.write(`Metadata: ${manifest.totalCases - noMetadata}/${manifest.totalCases} (generadas ahora: ${generated})\n`);
  process.stdout.write(`Structured: ${manifest.processedStructured}/${manifest.totalCases}\n`);
  process.stdout.write(`Enriquecidos (IA OK): ${manifest.enriched}/${manifest.totalCases}\n`);
  process.stdout.write(`Texto extraido: ${manifest.withExtractedText}/${manifest.totalCases}\n`);
  process.stdout.write(`Sin ECLI: ${noEcli}\n`);
  process.stdout.write(`Manifest: cases/manifest.json\n`);
  if (alerts.length > 0) {
    process.stdout.write(`\nAlertas (${alerts.length}):\n`);
    for (const alert of alerts) process.stdout.write(` - ${alert}\n`);
  } else {
    process.stdout.write("\nSin alertas.\n");
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
