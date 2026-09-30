import fs from "node:fs/promises";
import path from "node:path";
import { caseDir } from "./lib/paths.js";
import { parseCaseHeader, type HeaderFieldName } from "./lib/header_parser.js";
import { scanCases } from "./lib/manifest.js";
import { caseMetadataSchema, type CaseMetadata } from "./lib/schema.js";

const HEADER_TO_METADATA: Partial<Record<HeaderFieldName, keyof CaseMetadata>> = {
  id_cendoj: "id_cendoj",
  court: "court",
  seat: "seat",
  section: "section",
  resolution_date: "resolution_date",
  appeal_number: "appeal_number",
  resolution_number: "resolution_number",
  procedure_type: "procedure_type",
  rapporteur: "rapporteur",
};

async function readMetadata(entry: {
  caseDir: string;
  metadataFiles: string[];
  pdf: { roj: string | null; ecli: string | null; court: string | null; sha256: string };
}): Promise<{ metadata: CaseMetadata; filePath: string } | null> {
  const fileName = entry.metadataFiles[0];
  if (!fileName) return null;
  const filePath = path.join(caseDir(entry.caseDir), "metadata", fileName);
  try {
    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    const parsed = caseMetadataSchema.safeParse(raw);
    if (!parsed.success) return null;
    return { metadata: parsed.data, filePath };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const entries = await scanCases();
  const fieldCounts: Record<string, number> = {};
  const alerts: string[] = [];
  let updatedCases = 0;

  for (const entry of entries) {
    const loaded = await readMetadata(entry);
    if (!loaded) {
      alerts.push(`${entry.caseDir}: sin metadata legible`);
      continue;
    }
    const { metadata, filePath } = loaded;
    const before = JSON.stringify(metadata);
    const filled: string[] = [];

    const setText = (field: keyof CaseMetadata, value: string | undefined | null) => {
      if (!value) return;
      const current = metadata[field];
      if (current !== "UNKNOWN" && current !== "" && current !== undefined) return;
      metadata[field] = value;
      filled.push(String(field));
      fieldCounts[String(field)] = (fieldCounts[String(field)] ?? 0) + 1;
    };

    if (entry.pdf.ecli && metadata.ecli === "UNKNOWN") setText("ecli", entry.pdf.ecli);
    if (entry.pdf.roj && metadata.roj === "UNKNOWN") setText("roj", entry.pdf.roj);
    if (entry.pdf.court && metadata.court === "UNKNOWN") setText("court", entry.pdf.court);
    setText("sha256", entry.pdf.sha256);

    try {
      const text = await fs.readFile(path.join(caseDir(entry.caseDir), "extracted", "judgment.txt"), "utf8");
      const header = parseCaseHeader(text);
      for (const [headerField, metadataField] of Object.entries(HEADER_TO_METADATA)) {
        const key = headerField as HeaderFieldName;
        const value = header[key];
        if (metadataField) setText(metadataField, value);
      }
      if (!header.resolution_date && !header.court) {
        alerts.push(`${entry.caseDir}: cabecera CENDOJ no encontrada en el texto`);
      }
    } catch {
      alerts.push(`${entry.caseDir}: sin extracted/judgment.txt (ejecuta antes pnpm extract)`);
      continue;
    }

    if (JSON.stringify(metadata) !== before) {
      const valid = caseMetadataSchema.safeParse(metadata);
      if (!valid.success) {
        alerts.push(`${entry.caseDir}: metadata invalida tras rellenar`);
        continue;
      }
      await fs.writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      updatedCases += 1;
      if (filled.length > 0) {
        process.stdout.write(`${entry.caseDir}: +${filled.join(",")}\n`);
      }
    }
  }

  process.stdout.write("\n== FASE C1: METADATA DETERMINISTA ==\n");
  process.stdout.write(`Casos actualizados: ${updatedCases}/${entries.length}\n`);
  const fields = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
  if (fields.length > 0) {
    process.stdout.write("Campos rellenados:\n");
    for (const [field, count] of fields) process.stdout.write(` ${field}: ${count}\n`);
  }
  if (alerts.length > 0) {
    process.stdout.write(`Alertas (${alerts.length}):\n`);
    for (const alert of alerts) process.stdout.write(` - ${alert}\n`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
