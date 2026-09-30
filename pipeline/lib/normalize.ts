import { CIVIL_BRANCHES } from "./enrich_schema.js";

type Obj = Record<string, unknown>;

const PARTY_KINDS = ["PERSON", "COMPANY", "PUBLIC_ENTITY", "OTHER", "UNKNOWN"] as const;
const PARTY_SIDE = ["PLAINTIFF", "DEFENDANT", "THIRD_PARTY", "COURT", "OTHER"] as const;
const CLAIM_SIDE = ["PLAINTIFF", "DEFENDANT", "UNKNOWN"] as const;
const CLAIM_OUTCOME = [
  "GRANTED",
  "REJECTED",
  "PARTIALLY_GRANTED",
  "NOT_ANALYZED",
  "UNKNOWN",
] as const;
const CLAIM_SCOPE = ["FINAL", "FIRST_INSTANCE", "APPEAL", "CASSATION", "NONE"] as const;
const FACT_TYPE = ["FACTUAL", "PROCEDURAL", "JURIDICAL"] as const;
const FACT_STATUS = ["PROVEN", "ALLEGED", "DISPUTED", "UNKNOWN"] as const;
const DATE_PRECISION = ["DAY", "MONTH", "YEAR", "UNKNOWN"] as const;
const EVENT_TYPE = ["CONTRACT", "PROCEDURAL", "JUDGMENT", "NOTIFICATION", "OTHER"] as const;
const ARG_TYPE = ["LEGAL", "FACTUAL", "PROCEDURAL", "EVIDENTIARY"] as const;
const ARG_OUTCOME = [
  "ACCEPTED",
  "REJECTED",
  "PARTIALLY_ACCEPTED",
  "NOT_ANALYZED",
  "UNKNOWN",
] as const;
const LAW_RELEVANCE = ["APPLIED", "CITED", "DISCUSSED", "UNKNOWN"] as const;
const CASELAW_ROLE = ["DOCTRINE_APPLIED", "DISTINGUISHED", "CITED", "UNKNOWN"] as const;
const CASSATION_OUTCOME = ["ESTIMED", "DISMISSED", "PARTIALLY_ESTIMATED", "UNKNOWN"] as const;
const RECURRING_SIDE = ["PLAINTIFF", "DEFENDANT", "BOTH", "NONE", "UNKNOWN"] as const;
const INSTANCE = ["FIRST_INSTANCE", "APPEAL", "CASSATION", "OTHER"] as const;
const DECISION_RESULT = ["FAVOR_PLAINTIFF", "FAVOR_DEFENDANT", "PARTIAL", "UNKNOWN"] as const;
const FINALITY = ["FIRM", "APPEALED_PENDING", "REVOKED_ON_APPEAL", "UNKNOWN"] as const;
const YESNO = ["YES", "NO", "UNKNOWN"] as const;

const ALIASES: Record<string, string[]> = {
  CONTRACT: ["CONTRACTUAL"],
  CONTRACTAL: ["CONTRACTUAL"],
  CONTRACTIAL: ["CONTRACTUAL"],
  CONTRATUAL: ["CONTRACTUAL"],
  CONTRACTUAL_LAW: ["CONTRACTUAL"],
  CONSUMER: ["CONSUMER_ABUSIVE_CLAUSES"],
  CONSUMO: ["CONSUMER_ABUSIVE_CLAUSES"],
  CONSUMER_LAW: ["CONSUMER_ABUSIVE_CLAUSES"],
  CONSUMER_PROTECTION: ["CONSUMER_ABUSIVE_CLAUSES"],
  ABUSIVE_CLAUSES: ["CONSUMER_ABUSIVE_CLAUSES"],
  CLAUSULAS_ABUSIVAS: ["CONSUMER_ABUSIVE_CLAUSES"],
  LEASE: ["LEASE_PROPERTY"],
  LEASING: ["LEASE_PROPERTY"],
  ARRENDAMIENTO: ["LEASE_PROPERTY"],
  ARRENDAMIENTOS: ["LEASE_PROPERTY"],
  RENT: ["LEASE_PROPERTY"],
  TORT: ["CIVIL_LIABILITY"],
  NEGLIGENCE: ["CIVIL_LIABILITY"],
  COMMUNITY: ["PROPERTY_COMMUNITY"],
  COMMUNITY_PROPERTY: ["PROPERTY_COMMUNITY"],
  OWNERS_COMMUNITY: ["PROPERTY_COMMUNITY"],
  FAMILY_LAW: ["FAMILY"],
  SUCCESSION: ["SUCCESSIONS"],
  INHERITANCE: ["SUCCESSIONS"],
  WILLS: ["SUCCESSIONS"],
  COMMERCIAL_LAW: ["COMMERCIAL"],
  MERCANTIL: ["COMMERCIAL"],
  PROCEDURAL_LAW: ["PROCEDURAL"],
  PROCESAL: ["PROCEDURAL"],

  LEGAL: ["JURIDICAL"],
  JURIDICO: ["JURIDICAL"],
  JURIDICA: ["JURIDICAL"],
  JURIDIC: ["JURIDICAL"],
  FACTICO: ["FACTUAL"],
  FACTUAL_LAW: ["FACTUAL"],
  ALLEGED: ["FACTUAL"],
  PROVEN: ["FACTUAL"],
  DISPUTED: ["FACTUAL"],
  EVIDENTIARY: ["PROCEDURAL", "FACTUAL"],

  COURT: ["PUBLIC_ENTITY"],
  TRIBUNAL: ["COURT", "PUBLIC_ENTITY"],
  JUZGADO: ["COURT", "PUBLIC_ENTITY"],
  PERSONA: ["PERSON"],
  PERSON_NATURAL: ["PERSON"],
  INDIVIDUAL: ["PERSON"],
  EMPRESA: ["COMPANY"],
  SOCIEDAD: ["COMPANY"],
  FIRM: ["COMPANY"],
  ORGANIZATION: ["COMPANY"],
  ADMINISTRACION: ["PUBLIC_ENTITY"],
  PUBLIC_AUTHORITY: ["PUBLIC_ENTITY"],
  PUBLIC_BODY: ["PUBLIC_ENTITY"],
  GOVERNMENT: ["PUBLIC_ENTITY"],

  DEMANDANTE: ["PLAINTIFF"],
  ACTOR: ["PLAINTIFF"],
  DEMANDADO: ["DEFENDANT"],
  TERCERO: ["THIRD_PARTY"],
  JUEZ: ["COURT"],

  SI: ["YES"],
  "SÍ": ["YES"],
  S: ["YES"],
  N: ["NO"],

  ESTIMADO: ["ESTIMED"],
  ESTIMADA: ["ESTIMED"],
  ESTIMA: ["ESTIMED"],
  DESESTIMADO: ["DISMISSED"],
  DESESTIMADA: ["DISMISSED"],
  PARCIAL: ["PARTIALLY_ESTIMATED", "PARTIAL", "PARTIALLY_GRANTED"],
  PARCIALMENTE: ["PARTIALLY_ESTIMATED", "PARTIAL", "PARTIALLY_GRANTED"],
  PARTIAL: ["PARTIALLY_ESTIMATED", "PARTIAL", "PARTIALLY_GRANTED"],

  PROBADO: ["PROVEN"],
  PROBADA: ["PROVEN"],
  ALEGADO: ["ALLEGED"],
  ALEGADA: ["ALLEGED"],
  CONTROVERTIDO: ["DISPUTED"],
  CONTROVERTIDA: ["DISPUTED"],

  DIA: ["DAY"],
  MES: ["MONTH"],
  ANYO: ["YEAR"],
  AÑO: ["YEAR"],

  SENTENCIA: ["JUDGMENT"],
  NOTIFICACION: ["NOTIFICATION"],
  "NOTIFICACIÓN": ["NOTIFICATION"],
  CONTRATO: ["CONTRACT"],

  PROBATORIO: ["EVIDENTIARY"],
  EVIDENCIA: ["EVIDENTIARY"],
  PRUEBA: ["EVIDENTIARY"],

  ACEPTADO: ["ACCEPTED"],
  ACEPTADA: ["ACCEPTED"],
  RECHAZADO: ["REJECTED"],
  RECHAZADA: ["REJECTED"],
  PARCIALMENTE_ACEPTADO: ["PARTIALLY_ACCEPTED"],
  PARCIALMENTE_ACEPTADA: ["PARTIALLY_ACCEPTED"],

  APLICADO: ["APPLIED"],
  CITADO: ["CITED"],
  DISCUTIDO: ["DISCUSSED"],
  DOCTRINA_APLICADA: ["DOCTRINE_APPLIED"],
  DISTINGUIDA: ["DISTINGUISHED"],

  PRIMERA_INSTANCIA: ["FIRST_INSTANCE"],
  JUZGADO_PRIMERA_INSTANCIA: ["FIRST_INSTANCE"],
  APELACION: ["APPEAL"],
  "APELACIÓN": ["APPEAL"],
  CASACION: ["CASSATION"],
  "CASACIÓN": ["CASSATION"],
  FAVOR_ACTOR: ["FAVOR_PLAINTIFF"],
  FAVOR_DEMANDANTE: ["FAVOR_PLAINTIFF"],
  FAVOR_DEMANDADO: ["FAVOR_DEFENDANT"],

  FIRME: ["FIRM"],
  PENDIENTE: ["APPEALED_PENDING"],
  PENDIENTE_RECURSO: ["APPEALED_PENDING"],
  REVOCADA: ["REVOKED_ON_APPEAL"],
  REVOCADO: ["REVOKED_ON_APPEAL"],
};

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function coerceEnum(value: unknown, allowed: readonly string[]): unknown {
  if (typeof value !== "string") return value;
  const up = value.trim().toUpperCase().replace(/\s+/g, "_");
  if ((allowed as readonly string[]).includes(up)) return up;
  for (const candidate of ALIASES[up] ?? []) {
    if ((allowed as readonly string[]).includes(candidate)) return candidate;
  }
  return value;
}

function coerceBool(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : value;
  if (typeof value !== "string") return value;
  const up = value.trim().toUpperCase();
  if (up === "TRUE" || up === "YES" || up === "SI" || up === "SÍ") return true;
  if (up === "FALSE" || up === "NO" || up === "N") return false;
  return value;
}

function coerceInt(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^-?\d+(\.0+)?$/.test(trimmed)) return value;
  return Number(trimmed);
}

function mapObjs(value: unknown, fn: (item: Obj) => Obj): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => (isObj(item) ? fn(item) : item));
}

function withSources(item: Obj): Obj {
  return { ...item, sources: mapObjs(item.sources, (s) => ({ ...s, page: coerceInt(s.page) })) };
}

function withImportance(item: Obj): Obj {
  return { ...item, importance: coerceInt(item.importance) };
}

const OUTCOME_SIBLINGS = [
  "cassation_outcome",
  "recurring_side",
  "decisions",
  "claim_outcomes",
  "reasoning_summary",
] as const;

function rebuildOutcome(out: Obj): unknown {
  const current = out.outcome;
  if (current !== undefined && current !== null && isObj(current)) return current;
  const present = OUTCOME_SIBLINGS.filter((key) => key in out);
  if (present.length === 0) return current;
  const rebuilt: Obj = {};
  for (const key of OUTCOME_SIBLINGS) {
    if (key in out) rebuilt[key] = out[key];
  }
  if (typeof current === "string" && !("reasoning_summary" in rebuilt)) {
    rebuilt.reasoning_summary = current;
  }
  return rebuilt;
}


export function normalizeEnrichmentInput(input: unknown): unknown {
  if (!isObj(input)) return input;
  const out: Obj = { ...input };

  const parties = mapObjs(out.parties, (p) =>
    withSources({
      ...p,
      side: coerceEnum(p.side, PARTY_SIDE),
      kind: coerceEnum(p.kind, PARTY_KINDS),
      is_consumer: coerceEnum(p.is_consumer, YESNO),
    }),
  );
  const claims = mapObjs(out.claims, (c) =>
    withSources({
      ...c,
      side: coerceEnum(c.side, CLAIM_SIDE),
      outcome: coerceEnum(c.outcome, CLAIM_OUTCOME),
      outcome_scope: coerceEnum(c.outcome_scope, CLAIM_SCOPE),
    }),
  );
  const facts = mapObjs(out.facts, (f) =>
    withSources(
      withImportance({
        ...f,
        fact_type: coerceEnum(f.fact_type, FACT_TYPE),
        status: coerceEnum(f.status, FACT_STATUS),
      }),
    ),
  );
  const timeline = mapObjs(out.timeline, (e) =>
    withSources({
      ...e,
      date_precision: coerceEnum(e.date_precision, DATE_PRECISION),
      event_type: coerceEnum(e.event_type, EVENT_TYPE),
    }),
  );
  const args = mapObjs(out.arguments, (a) =>
    withSources(
      withImportance({
        ...a,
        side: coerceEnum(a.side, PARTY_SIDE),
        type: coerceEnum(a.type, ARG_TYPE),
        outcome: coerceEnum(a.outcome, ARG_OUTCOME),
      }),
    ),
  );
  const reasoning = mapObjs(out.reasoning, (h) =>
    withSources(
      withImportance({
        ...h,
        is_literal_quote: coerceBool(h.is_literal_quote),
      }),
    ),
  );
  const citedLaws = mapObjs(out.cited_laws, (l) =>
    withSources({ ...l, relevance: coerceEnum(l.relevance, LAW_RELEVANCE) }),
  );
  const citedCaseLaw = mapObjs(out.cited_case_law, (c) =>
    withSources({ ...c, role: coerceEnum(c.role, CASELAW_ROLE) }),
  );
  const issues = mapObjs(out.issues, (i) => withSources(withImportance(i)));

  let outcome = rebuildOutcome(out);
  if (isObj(outcome)) {
    const decisions = mapObjs(outcome.decisions, (d) =>
      withSources({
        ...d,
        instance: coerceEnum(d.instance, INSTANCE),
        result: coerceEnum(d.result, DECISION_RESULT),
      }),
    );
    const claimOutcomes = mapObjs(outcome.claim_outcomes, (co) =>
      withSources({ ...co, outcome: coerceEnum(co.outcome, CLAIM_OUTCOME) }),
    );
    outcome = {
      ...outcome,
      cassation_outcome: coerceEnum(outcome.cassation_outcome, CASSATION_OUTCOME),
      recurring_side: coerceEnum(outcome.recurring_side, RECURRING_SIDE),
      decisions,
      claim_outcomes: claimOutcomes,
    };
  }

  let classification = out.classification;
  if (isObj(classification)) {
    classification = {
      ...classification,
      civil_branch: coerceEnum(classification.civil_branch, CIVIL_BRANCHES),
      finality_status: coerceEnum(classification.finality_status, FINALITY),
    };
  }

  return {
    ...out,
    parties,
    claims,
    facts,
    timeline,
    arguments: args,
    reasoning,
    cited_laws: citedLaws,
    cited_case_law: citedCaseLaw,
    issues,
    outcome,
    classification,
  };
}
