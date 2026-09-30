import fs from "node:fs/promises";
import path from "node:path";
import {
  boeIdsInText,
  checkCitations,
  compareGolden,
  detectOutcomeFromText,
  detectSiglasInText,
  falloSection,
  summarize,
  type ActualCase,
  type GoldenEntry,
} from "./lib/eval.js";
import { CASES_DIR, LAWS_DIR } from "./lib/paths.js";

interface Args {
  seedGolden: boolean;
  show: string | null;
  confirm: string[];
}

function parseArgs(argv: string[]): Args {
  const args: Args = { seedGolden: false, show: null, confirm: [] };
  for (const arg of argv) {
    if (arg === "--seed-golden") args.seedGolden = true;
    const show = arg.match(/^--show=(.+)$/);
    const confirm = arg.match(/^--confirm=(.+)$/);
    if (/^case_\d{6}$/.test(arg)) args.show = arg;
    if (show?.[1]) args.show = show[1].trim();
    if (confirm?.[1]) {
      args.confirm = confirm[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }
  return args;
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function section<T>(caseId: string, file: string): Promise<T | null> {
  return readJson<T>(path.join(CASES_DIR, caseId, "structured", file));
}

interface Ref {
  boe_id?: string | null;
  ai_boe_id?: string | null;
  ai_boe_id_in_catalog?: boolean | null;
  id_source?: string | null;
  id_conflict?: boolean;
  status?: string;
  quote_check?: string;
}

async function loadActual(caseId: string): Promise<ActualCase | null> {
  const [summary, classification, outcome, facts, reasoning, lawRefs] = await Promise.all([
    section<{ summary?: { headline?: string } }>(caseId, "summary.json"),
    section<{ classification?: { civil_branch?: string } }>(caseId, "classification.json"),
    section<{ outcome?: { cassation_outcome?: string } }>(caseId, "outcome.json"),
    section<{ facts?: unknown[] }>(caseId, "facts.json"),
    section<{ holdings?: unknown[] }>(caseId, "reasoning.json"),
    section<{ refs?: Ref[] }>(caseId, "law_refs.json"),
  ]);
  if (!outcome?.outcome?.cassation_outcome) return null;
  return {
    caseId,
    cassation_outcome: outcome.outcome.cassation_outcome,
    civil_branch: classification?.classification?.civil_branch ?? "UNKNOWN",
    headline: summary?.summary?.headline ?? "",
    holdings: reasoning?.holdings?.length ?? 0,
    facts: facts?.facts?.length ?? 0,
    citedBoeIds: [
      ...new Set(
        (lawRefs?.refs ?? [])
          .filter((ref) => ref.id_source === "pipeline" && ref.boe_id)
          .map((ref) => ref.boe_id as string),
      ),
    ],
  };
}

async function showCase(
  caseId: string,
  actuals: ActualCase[],
  texts: Map<string, string>,
  golden: { version: number; entries: GoldenEntry[] } | null,
): Promise<void> {
  const actual = actuals.find((item) => item.caseId === caseId);
  const text = texts.get(caseId);
  if (!actual) {
    process.stderr.write(`${caseId}: no tiene extracción de IA todavía.\n`);
    process.exitCode = 1;
    return;
  }

  const detected = text ? detectOutcomeFromText(text) : "UNKNOWN";
  const cites = text ? boeIdsInText(text) : [];
  const siglas = text ? detectSiglasInText(text) : [];
  const fallo = text ? falloSection(text).replace(/\s+/g, " ").slice(0, 400) : "(sin texto)";
  const existing = golden?.entries.find((entry) => entry.caseId === caseId) ?? null;

  const expect: GoldenEntry["expect"] = { ...(existing?.expect ?? {}) };
  if (!expect.cassation_outcome && detected !== "UNKNOWN") expect.cassation_outcome = detected;
  if (!expect.must_cite_boe_ids && cites.length > 0) expect.must_cite_boe_ids = cites;

  process.stdout.write(`\n===== ${caseId} =====\n`);
  process.stdout.write("EXTRACCIÓN (IA)\n");
  process.stdout.write(`  resultado:        ${actual.cassation_outcome}\n`);
  process.stdout.write(`  rama civil:       ${actual.civil_branch}\n`);
  process.stdout.write(`  título:           ${actual.headline}\n`);
  process.stdout.write(`  holdings/facts:   ${actual.holdings}/${actual.facts}\n`);
  process.stdout.write(`  normas verificadas: ${actual.citedBoeIds.join(", ") || "(ninguna)"}\n`);
  process.stdout.write("\nEVIDENCIA EN EL PDF (independiente de la IA)\n");
  process.stdout.write(`  reglas sobre el fallo → ${detected}\n`);
  process.stdout.write(`  siglas detectadas → ${siglas.join(", ") || "(ninguna)"}\n`);
  process.stdout.write(`  normas que exige    → ${cites.join(", ") || "(ninguna)"}\n`);
  process.stdout.write(`  parte dispositiva: «…${fallo}…»\n`);
  process.stdout.write("\nCOMPRUEBA EN EL PDF Y COMPLETA LO QUE FALTE\n");
  process.stdout.write(
    "  Añade a \"expect\" los campos que verifiques a mano: civil_branch,\n" +
      "  headline_contains, min_holdings, min_facts, must_cite_boe_ids.\n",
  );
  if (existing) {
    process.stdout.write(`\nENTRADA ACTUAL (confirmed=${existing.confirmed}, source=${existing.source})\n`);
    process.stdout.write(`${JSON.stringify(existing, null, 2)}\n`);
  }
  const suggested: GoldenEntry = {
    caseId,
    expect,
    source: existing?.source === "human" ? "human" : "auto-rule",
    confirmed: existing?.confirmed ?? false,
    notes: existing?.notes ?? "Pendiente de verificación manual contra el PDF",
  };
  process.stdout.write("\nENTRADA SUGERIDA (pega/actualiza en cases/golden.json y pon confirmed=true)\n");
  process.stdout.write(`${JSON.stringify(suggested, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const caseNames = (await fs.readdir(CASES_DIR)).filter((name) => /^case_\d{6}$/.test(name)).sort();

  const actuals: ActualCase[] = [];
  const texts = new Map<string, string>();
  const reviews: Array<{ caseId: string; status: string }> = [];
  const refs: Array<{ caseId: string; ref: Ref }> = [];
  let provenanceOk = 0;
  let enriched = 0;

  const ai = {
    enrichCases: 0,
    enrichCost: 0,
    enrichTokens: 0,
    perCase: [] as number[],
    viasReports: 0,
    viasCost: 0,
    viasTokens: 0,
  };

  const pdfCheck = {
    checkable: 0,
    matched: 0,
    notCheckable: 0,
    missing: [] as Array<{ caseId: string; norma: string }>,
    pdfOnly: [] as Array<{ caseId: string; siglas: string[] }>,
  };

  for (const caseId of caseNames) {
    const actual = await loadActual(caseId);
    if (!actual) continue;
    actuals.push(actual);
    const text = await fs
      .readFile(path.join(CASES_DIR, caseId, "extracted", "judgment.txt"), "utf8")
      .catch(() => "");
    if (text) texts.set(caseId, text);
    const review = await section<{
      extraction?: {
        validation?: string;
        model?: string;
        prompt_version?: string;
        cost?: number;
        tokens?: { total?: number };
      };
      review?: { status?: string };
    }>(caseId, "review.json");
    if (review?.extraction?.validation === "OK") {
      enriched += 1;
      if (review.extraction.model && review.extraction.prompt_version && review.extraction.tokens) {
        provenanceOk += 1;
      }
      const cost = review.extraction.cost ?? 0;
      const tokens = review.extraction.tokens?.total ?? 0;
      ai.enrichCases += 1;
      ai.enrichCost += cost;
      ai.enrichTokens += tokens;
      if (cost > 0) ai.perCase.push(cost);
    }
    reviews.push({ caseId, status: review?.review?.status ?? "UNREVIEWED" });
    for (const ref of (await section<{ refs?: Ref[] }>(caseId, "law_refs.json"))?.refs ?? []) {
      refs.push({ caseId, ref });
    }

    const vias = await readJson<{ analysis?: { cost?: number; tokens?: { total?: number } } }>(
      path.join(CASES_DIR, caseId, "structured", "vias.json"),
    );
    if (vias?.analysis) {
      ai.viasReports += 1;
      ai.viasCost += vias.analysis.cost ?? 0;
      ai.viasTokens += vias.analysis.tokens?.total ?? 0;
    }

    if (text) {
      const cited = await section<{ citations?: Array<{ norma?: string }> }>(
        caseId,
        "cited_laws.json",
      );
      const normas = (cited?.citations ?? [])
        .map((item) => item.norma ?? "")
        .filter((item) => item.trim().length > 0);
      if (normas.length > 0) {
        const result = checkCitations(caseId, normas, text);
        pdfCheck.checkable += result.checkable;
        pdfCheck.matched += result.matched;
        pdfCheck.notCheckable += result.notCheckable;
        for (const norma of result.missing) {
          if (pdfCheck.missing.length < 30) pdfCheck.missing.push({ caseId, norma });
        }
        if (result.pdfOnly.length > 0 && pdfCheck.pdfOnly.length < 30) {
          pdfCheck.pdfOnly.push({ caseId, siglas: result.pdfOnly });
        }
      }
    }
  }

  // 1. Verificación cruzada: reglas sobre el PDF vs extracción de la IA
  const cross = { total: 0, agreement: 0, disagreement: 0, unknown: 0, details: [] as Array<{ caseId: string; ia: string; reglas: string }> };
  for (const actual of actuals) {
    const text = texts.get(actual.caseId);
    if (!text) continue;
    const detected = detectOutcomeFromText(text);
    if (detected === "UNKNOWN") {
      cross.unknown += 1;
      continue;
    }
    cross.total += 1;
    if (detected === actual.cassation_outcome) cross.agreement += 1;
    else {
      cross.disagreement += 1;
      cross.details.push({ caseId: actual.caseId, ia: actual.cassation_outcome, reglas: detected });
    }
  }

  // 2. Citas y procedencia
  const statusCounts: Record<string, number> = {};
  const quoteCounts: Record<string, number> = {};
  let aiIds = 0;
  let aiIdsInvented = 0;
  let conflicts = 0;
  for (const { ref } of refs) {
    statusCounts[ref.status ?? "UNKNOWN"] = (statusCounts[ref.status ?? "UNKNOWN"] ?? 0) + 1;
    quoteCounts[ref.quote_check ?? "NOT_CHECKED"] =
      (quoteCounts[ref.quote_check ?? "NOT_CHECKED"] ?? 0) + 1;
    if (ref.ai_boe_id) {
      aiIds += 1;
      if (ref.ai_boe_id_in_catalog === false) aiIdsInvented += 1;
      if (ref.id_conflict) conflicts += 1;
    }
  }
  const totalRefs = refs.length;
  const verified = statusCounts.VERIFIED ?? 0;

  // 3. Golden dataset
  const goldenPath = path.join(CASES_DIR, "golden.json");
  let golden = await readJson<{ version: number; entries: GoldenEntry[] }>(goldenPath);

  if (args.show) {
    await showCase(args.show, actuals, texts, golden);
    return;
  }

  if (args.confirm.length > 0) {
    const entries = golden?.entries ?? [];
    const index = new Map(entries.map((entry) => [entry.caseId, entry]));
    let confirmedCount = 0;
    for (const caseId of args.confirm) {
      const entry = index.get(caseId);
      if (!entry) {
        process.stderr.write(`${caseId}: sin entrada en golden.json (ejecuta --seed-golden)\n`);
        continue;
      }
      entry.confirmed = true;
      entry.source = "human";
      entry.notes = entry.notes?.replace("Pendiente de verificación manual", "Verificado a mano") ?? "Verificado a mano";
      confirmedCount += 1;
    }
    if (confirmedCount > 0) {
      await fs.writeFile(goldenPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");
      process.stdout.write(`Confirmadas ${confirmedCount} entradas de golden.json\n`);
    }
  }

  if (args.seedGolden) {
    const entries: GoldenEntry[] = (golden?.entries ?? []).filter(
      (entry) => entry.source === "human" || entry.confirmed,
    );
    const known = new Set(entries.map((entry) => entry.caseId));
    for (const actual of actuals) {
      if (known.has(actual.caseId)) continue;
      const text = texts.get(actual.caseId);
      if (!text) continue;
      const detected = detectOutcomeFromText(text);
      const cites = boeIdsInText(text);
      if (detected === "UNKNOWN" && cites.length === 0) continue;
      const expect: GoldenEntry["expect"] = {};
      if (detected !== "UNKNOWN") expect.cassation_outcome = detected;
      if (cites.length > 0) expect.must_cite_boe_ids = cites;
      entries.push({
        caseId: actual.caseId,
        expect,
        source: "auto-rule",
        confirmed: false,
        notes:
          "Derivado del propio PDF (parte dispositiva y siglas presentes); revisar y marcar como confirmado",
      });
    }
    golden = { version: golden?.version ?? 1, entries };
    await fs.writeFile(goldenPath, `${JSON.stringify(golden, null, 2)}\n`, "utf8");
    process.stdout.write(`Golden actualizado: ${golden.entries.length} entradas (${goldenPath})\n`);
  }

  const actualByCase = new Map(actuals.map((item) => [item.caseId, item]));
  const goldenResults = (golden?.entries ?? [])
    .map((entry) => {
      const actual = actualByCase.get(entry.caseId);
      if (!actual) return null;
      return { caseId: entry.caseId, confirmed: entry.confirmed, results: compareGolden(entry, actual) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const summary = summarize(goldenResults);
  const confirmed = goldenResults.filter((item) => item.confirmed);

  const report = {
    generated_at: new Date().toISOString(),
    corpus: {
      cases: caseNames.length,
      with_extraction: texts.size,
      enriched,
      provenance_complete: provenanceOk,
      reviewed: reviews.filter((item) => item.status !== "UNREVIEWED").length,
    },
    ia: {
      enrich_cases: ai.enrichCases,
      enrich_tokens: ai.enrichTokens,
      enrich_cost: Number(ai.enrichCost.toFixed(4)),
      cost_per_case: {
        avg: ai.perCase.length
          ? Number((ai.enrichCost / ai.perCase.length).toFixed(5))
          : null,
        min: ai.perCase.length ? Number(Math.min(...ai.perCase).toFixed(5)) : null,
        max: ai.perCase.length ? Number(Math.max(...ai.perCase).toFixed(5)) : null,
      },
      vias_reports: ai.viasReports,
      vias_tokens: ai.viasTokens,
      vias_cost: Number(ai.viasCost.toFixed(4)),
      total_cost: Number((ai.enrichCost + ai.viasCost).toFixed(4)),
    },
    cross_check_outcome: {
      ...cross,
      agreement_rate:
        cross.total > 0 ? Number((cross.agreement / cross.total).toFixed(4)) : null,
      details: cross.details.slice(0, 30),
    },
    citations: {
      total: totalRefs,
      verified: verified,
      verified_rate: totalRefs > 0 ? Number((verified / totalRefs).toFixed(4)) : null,
      by_status: statusCounts,
      by_quote_check: quoteCounts,
      ai_ids: aiIds,
      ai_ids_invented: aiIdsInvented,
      ai_id_conflicts: conflicts,
      pdf_cross_check: {
        checkable: pdfCheck.checkable,
        matched: pdfCheck.matched,
        matched_rate:
          pdfCheck.checkable > 0
            ? Number((pdfCheck.matched / pdfCheck.checkable).toFixed(4))
            : null,
        not_checkable: pdfCheck.notCheckable,
        missing_in_pdf: pdfCheck.missing,
        present_only_in_pdf: pdfCheck.pdfOnly,
      },
    },
    golden: {
      path: goldenPath,
      entries: golden?.entries.length ?? 0,
      confirmed_entries: confirmed.length,
      auto_entries: (golden?.entries ?? []).filter((entry) => !entry.confirmed).length,
      fields: summary.fields,
      passed: summary.passed,
      failed: summary.failed,
      by_field: summary.byField,
      failures: summary.failures.slice(0, 30),
    },
  };
  await fs.writeFile(
    path.join(CASES_DIR, "eval_report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  const pct = (value: number, total: number) =>
    total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "n/d";

  process.stdout.write("\n== EVALUACIÓN DEL CORPUS ==\n");
  process.stdout.write(`Casos: ${report.corpus.cases} · con texto: ${report.corpus.with_extraction} · enriquecidos: ${enriched}\n`);
  process.stdout.write(`Procedencia completa (modelo+prompt+tokens): ${provenanceOk}/${enriched}\n`);
  process.stdout.write(`Revisados a mano: ${report.corpus.reviewed}\n`);
  process.stdout.write("\nCoste de IA reportado por opencode (solo enriquecimiento y vías):\n");
  process.stdout.write(
    `  enriquecimiento: ${report.ia.enrich_cases} casos · ${report.ia.enrich_tokens} tokens · $${report.ia.enrich_cost}\n`,
  );
  if (report.ia.cost_per_case.avg !== null) {
    process.stdout.write(
      `  por caso: media $${report.ia.cost_per_case.avg} · mín $${report.ia.cost_per_case.min} · máx $${report.ia.cost_per_case.max}\n`,
    );
  }
  process.stdout.write(
    `  vías: ${report.ia.vias_reports} informes · ${report.ia.vias_tokens} tokens · $${report.ia.vias_cost}\n`,
  );
  process.stdout.write(`  TOTAL registrado: $${report.ia.total_cost}\n`);
  process.stdout.write(
    "  resto de pasos (laws, hygiene, extract, metadata, match, patterns, search, eval, supplement): $0\n",
  );
  process.stdout.write("\nCruce de la salida (IA) contra la parte dispositiva del PDF:\n");
  process.stdout.write(`  comparables: ${cross.total} · sin pronunciamiento claro: ${cross.unknown}\n`);
  process.stdout.write(`  acuerdo: ${cross.agreement}/${cross.total} (${pct(cross.agreement, cross.total)})\n`);
  process.stdout.write(`  desacuerdos: ${cross.disagreement}\n`);
  for (const item of cross.details.slice(0, 10)) {
    process.stdout.write(`   - ${item.caseId}: IA=${item.ia} reglas=${item.reglas}\n`);
  }
  process.stdout.write("\nCitas de leyes:\n");
  process.stdout.write(`  verificadas: ${verified}/${totalRefs} (${pct(verified, totalRefs)})\n`);
  process.stdout.write(
    `  ids aportados por la IA: ${aiIds} · inventados (fuera del catálogo): ${aiIdsInvented} · contradichos: ${conflicts}\n`,
  );
  process.stdout.write(
    `  siglas de la IA presentes en el propio PDF: ${pdfCheck.matched}/${pdfCheck.checkable} (${pct(pdfCheck.matched, pdfCheck.checkable)}) · no comprobables: ${pdfCheck.notCheckable}\n`,
  );
  for (const item of pdfCheck.missing.slice(0, 8)) {
    process.stdout.write(`   - ausente en el PDF: ${item.caseId} → ${item.norma}\n`);
  }
  process.stdout.write("\nGolden dataset:\n");
  process.stdout.write(
    `  entradas: ${golden?.entries.length ?? 0} (confirmadas: ${confirmed.length}, automáticas: ${report.golden.auto_entries})\n`,
  );
  process.stdout.write(
    `  campos evaluados: ${summary.fields} · OK: ${summary.passed} · KO: ${summary.failed} (${pct(summary.passed, summary.fields)})\n`,
  );
  for (const failure of summary.failures.slice(0, 10)) {
    process.stdout.write(
      `   - ${failure.caseId} ${failure.field}: esperado ${failure.expected}, obtenido ${failure.actual}${failure.confirmed ? "" : " [no confirmado]"}\n`,
    );
  }
  process.stdout.write("\nEscrito: cases/eval_report.json\n");
  process.stdout.write(
    "Nota: las entradas automáticas derivan del propio PDF y no sustituyen la revisión humana.\n",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
