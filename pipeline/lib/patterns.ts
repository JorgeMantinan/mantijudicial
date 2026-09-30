export interface CaseSignals {
  caseId: string;
  branch: string;
  subtopic: string;
  cassation: string;
  recurringSide: string;
  claims: Array<{ outcome: string; scope: string }>;
  args: Array<{ type: string; side: string; outcome: string }>;
  holdings: Array<{ topic: string; doctrine: string }>;
  issues: Array<{ topic: string }>;
  laws: Array<{ boe_id: string | null; sigla: string; status: string }>;
}

export interface Distribution {
  total: number;
  counts: Record<string, number>;
}

export interface GroupStats {
  key: string;
  cases: number;
  distribution: Distribution;
  share_estimated: number | null;
}

export interface Patterns {
  min_support: number;
  cases_analyzed: number;
  outcomes: Distribution;
  by_branch: GroupStats[];
  by_recurring_side: GroupStats[];
  by_argument_type: Array<{ key: string; cases: number; outcomes: Record<string, number> }>;
  by_argument_outcome: Distribution;
  by_holding_topic: GroupStats[];
  by_doctrine: GroupStats[];
  by_issue: GroupStats[];
  by_verified_law: Array<{
    boe_id: string;
    siglas: string[];
    cases: number;
    outcomes: Record<string, number>;
  }>;
}

export function distribution(values: string[]): Distribution {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return { total: values.length, counts };
}

export function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function shareEstimated(dist: Distribution): number | null {
  if (dist.total === 0) return null;
  const estimated = (dist.counts.ESTIMED ?? 0) + (dist.counts.PARTIALLY_ESTIMATED ?? 0);
  return Number((estimated / dist.total).toFixed(3));
}

function groupBy(
  cases: CaseSignals[],
  keysOf: (item: CaseSignals) => string[],
  minSupport: number,
): GroupStats[] {
  const groups = new Map<string, { caseIds: Set<string>; outcomes: Map<string, string> }>();
  for (const item of cases) {
    for (const key of keysOf(item)) {
      if (!key) continue;
      const group = groups.get(key) ?? { caseIds: new Set<string>(), outcomes: new Map<string, string>() };
      group.caseIds.add(item.caseId);
      group.outcomes.set(item.caseId, item.cassation);
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const dist = distribution([...group.outcomes.values()]);
      return {
        key,
        cases: group.caseIds.size,
        distribution: dist,
        share_estimated: shareEstimated(dist),
      };
    })
    .filter((group) => group.cases >= minSupport)
    .sort((a, b) => b.cases - a.cases || a.key.localeCompare(b.key));
}

function uniqueKeys(values: string[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const key = normalizeKey(value);
    if (key.length > 0 && key !== "unknown") seen.add(key);
  }
  return [...seen];
}

export function aggregate(cases: CaseSignals[], minSupport: number): Patterns {
  const outcomes = distribution(cases.map((item) => item.cassation));

  const argGroups = new Map<string, { caseIds: Set<string>; outcomes: Map<string, number> }>();
  for (const item of cases) {
    for (const argument of item.args) {
      const key = normalizeKey(argument.type);
      if (!key) continue;
      const group = argGroups.get(key) ?? {
        caseIds: new Set<string>(),
        outcomes: new Map<string, number>(),
      };
      group.caseIds.add(item.caseId);
      group.outcomes.set(argument.outcome, (group.outcomes.get(argument.outcome) ?? 0) + 1);
      argGroups.set(key, group);
    }
  }
  const byArgumentType = [...argGroups.entries()]
    .map(([key, group]) => ({
      key,
      cases: group.caseIds.size,
      outcomes: Object.fromEntries(group.outcomes),
    }))
    .filter((row) => row.cases >= minSupport)
    .sort((a, b) => b.cases - a.cases || a.key.localeCompare(b.key));

  const lawGroups = new Map<
    string,
    { siglas: Set<string>; outcomes: Map<string, string> }
  >();
  for (const item of cases) {
    for (const law of item.laws) {
      if (law.status !== "VERIFIED" || !law.boe_id) continue;
      const group = lawGroups.get(law.boe_id) ?? {
        siglas: new Set<string>(),
        outcomes: new Map<string, string>(),
      };
      if (law.sigla) group.siglas.add(law.sigla);
      group.outcomes.set(item.caseId, item.cassation);
      lawGroups.set(law.boe_id, group);
    }
  }
  const byVerifiedLaw = [...lawGroups.entries()]
    .map(([boeId, group]) => ({
      boe_id: boeId,
      siglas: [...group.siglas].sort(),
      cases: group.outcomes.size,
      outcomes: Object.fromEntries(Object.entries(distribution([...group.outcomes.values()]).counts)),
    }))
    .filter((row) => row.cases >= minSupport)
    .sort((a, b) => b.cases - a.cases || a.boe_id.localeCompare(b.boe_id));

  return {
    min_support: minSupport,
    cases_analyzed: cases.length,
    outcomes,
    by_branch: groupBy(cases, (item) => [normalizeKey(item.branch)], minSupport),
    by_recurring_side: groupBy(cases, (item) => [normalizeKey(item.recurringSide)], minSupport),
    by_argument_type: byArgumentType,
    by_argument_outcome: distribution(cases.flatMap((item) => item.args.map((a) => a.outcome))),
    by_holding_topic: groupBy(
      cases,
      (item) => uniqueKeys(item.holdings.map((holding) => holding.topic)),
      minSupport,
    ),
    by_doctrine: groupBy(
      cases,
      (item) => uniqueKeys(item.holdings.map((holding) => holding.doctrine)),
      minSupport,
    ),
    by_issue: groupBy(cases, (item) => uniqueKeys(item.issues.map((issue) => issue.topic)), minSupport),
    by_verified_law: byVerifiedLaw,
  };
}
