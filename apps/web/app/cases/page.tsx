import Link from "next/link";
import { canCreateCase } from "@pipeline/authorization";
import { canViewCase, defaultOrgId, requireActor } from "@/lib/auth";
import { listCases } from "@/lib/dataset";
import { authorizationGrants } from "@/lib/grants";
import { BRANCH, OUTCOME, SIDE, label } from "@/lib/labels";
import { OutcomeBadge } from "@/lib/ui";
import { SortTh } from "@/lib/sort-th";
import { IngestForm } from "./ingest-form";

export const dynamic = "force-dynamic";

const SORTS = ["case", "title", "branch", "outcome", "side", "ia"] as const;
type SortKey = (typeof SORTS)[number];

function sortValue(item: Awaited<ReturnType<typeof listCases>>[number], key: SortKey): string | number {
  switch (key) {
    case "case":
      return item.id;
    case "title":
      return item.headline;
    case "branch":
      return label(BRANCH, item.branch);
    case "outcome":
      return label(OUTCOME, item.outcome);
    case "side":
      return label(SIDE, item.recurringSide);
    case "ia":
      return item.enriched ? 1 : 0;
  }
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    branch?: string;
    outcome?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const params = await searchParams;
  const actor = await requireActor();
  const orgId = await defaultOrgId();
  const canCreate = canCreateCase(actor);
  const grants = await authorizationGrants();
  const cases = (
    await listCases({
      branch: params.branch,
      outcome: params.outcome,
      q: params.q,
    })
  ).filter((item) => canViewCase(actor, item.id, orgId, grants));

  const sort = (SORTS as readonly string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "case";
  const dir = params.dir === "desc" ? "desc" : "asc";
  const sorted = [...cases].sort((a, b) => {
    const av = sortValue(a, sort);
    const bv = sortValue(b, sort);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "es");
    return dir === "asc" ? cmp : -cmp;
  });

  const base: Record<string, string | undefined> = {
    branch: params.branch,
    outcome: params.outcome,
    q: params.q,
  };

  return (
    <>
      <h1>Casos</h1>
      <p className="lead">
        {cases.length} casos según los filtros aplicados. Pulsa una cabecera para ordenar.
      </p>

      {canCreate && (
        <div className="section">
          <h2>Subir un caso nuevo</h2>
          <p className="small muted">
            El PDF pasa por extracción de texto, metadata, análisis IA y cruce con el BOE. Requiere
            revisión humana posterior.
          </p>
          <IngestForm />
        </div>
      )}

      <form className="filters" action="/cases" method="get">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar por título, asunto o identificador"
        />
        <select name="branch" defaultValue={params.branch ?? ""}>
          <option value="">Todas las ramas</option>
          {Object.entries(BRANCH).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <select name="outcome" defaultValue={params.outcome ?? ""}>
          <option value="">Todos los resultados</option>
          {Object.entries(OUTCOME).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
        <button type="submit">Filtrar</button>
      </form>

      <table>
        <thead>
          <tr>
            <SortTh path="/cases" sortKey="case" current={sort} dir={dir} label="Caso" base={base} />
            <SortTh path="/cases" sortKey="title" current={sort} dir={dir} label="Asunto" base={base} />
            <SortTh path="/cases" sortKey="branch" current={sort} dir={dir} label="Rama" base={base} />
            <SortTh path="/cases" sortKey="outcome" current={sort} dir={dir} label="Resultado" base={base} />
            <SortTh path="/cases" sortKey="side" current={sort} dir={dir} label="Recurrente" base={base} />
            <SortTh path="/cases" sortKey="ia" current={sort} dir={dir} label="IA" base={base} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id}>
              <td className="mono">
                <Link href={`/cases/${item.id}`}>{item.id.replace("case_", "")}</Link>
              </td>
              <td>
                <Link href={`/cases/${item.id}`}>{item.headline}</Link>
              </td>
              <td className="small">{label(BRANCH, item.branch)}</td>
              <td>
                <OutcomeBadge outcome={item.outcome} />
              </td>
              <td className="small">{label(SIDE, item.recurringSide)}</td>
              <td className="small">
                {item.enriched ? <span className="badge ok">OK</span> : <span className="muted">—</span>}
                {item.stale && (
                  <span className="badge warn" title="El PDF es más nuevo que el análisis">
                    reanalizar
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sorted.length === 0 && <p className="muted">Sin resultados con esos filtros.</p>}
    </>
  );
}
