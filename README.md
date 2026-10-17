# MantiJudicial

[![CI](https://github.com/JorgeMantinan/mantijudicial/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/JorgeMantinan/mantijudicial/actions/workflows/ci.yml)

Pipeline TypeScript de análisis de jurisprudencia del Tribunal Supremo y legislación del BOE, más una web Next.js para despachos de abogados: consulta de casos enriquecidos con IA, informes, alertas, temas, evolución jurisprudencial y borradores de escritos. Todo el texto de UI en castellano.

## Características

- Pipeline CLI de extracción y análisis de sentencias en PDF (`hygiene`, `extract`, `metadata`, `enrich`, `match`, `patterns`, `search`, `vias`, `ingest`, `seed`, `eval`, `supplement`, `compare`, `escrito`)
- Procesamiento de legislación del BOE (`laws`) y vinculación con la jurisprudencia
- Enriquecimiento con IA compatible OpenAI (`AI_API_KEY`) o proveedor local `opencode` como alternativa
- Web Next.js con búsqueda, casos, leyes, informes, alertas, temas, evolución, revisión y generación de borradores de escrito
- Permisos por despacho y rol con modelo deny-by-default (`pipeline/lib/authorization.ts`)
- Vistas imprimibles (PDF del navegador) de casos, dossier, comparación, alertas y temas
- Tests unitarios con Vitest sobre el pipeline y la lib de la web

## Stack

| Capa | Tecnología |
|---|---|
| Pipeline | TypeScript + tsx (CLI), Zod, pdfjs-dist |
| Web | Next.js 16 (App Router), React 19, TypeScript |
| Datos | Corpus en disco (`cases/`, `laws/`, `data/`) leído por `apps/web/lib/dataset.ts` |
| IA | Proveedor HTTP compatible OpenAI o binario `opencode` (`pipeline/lib/ai_provider.ts`) |
| Workspace | pnpm workspaces (`apps/*`) |
| Testing | Vitest |
| CI | GitHub Actions (`.github/workflows/ci.yml`) |
| Despliegue | Blueprint de Render (`render.yaml`) con disco persistente |

## Estructura

```
mantijudicial/
├── pipeline/              CLIs de análisis (01_hygiene … 15_escrito) + lib/ (módulos y tests)
├── apps/
│   └── web/               Next.js: app router, lib/dataset.ts, componentes
├── cases/                 Corpus de sentencias (fuera de git)
├── laws/                  Legislación BOE (fuera de git)
├── data/                  Identidad y datos operativos (fuera de git)
├── docs/                  Documentación de diseño (00_README.md es el índice)
├── scripts/               Utilidades: push-data, render-bootstrap, corpus de juguete, backups
├── supabase/              schema.sql de identidad (pendiente de activar)
└── render.yaml            Blueprint de despliegue en Render
```

## Datos y repositorio de datos

Este repositorio contiene **solo código** (`main`). Los datos no viajan por aquí:

- El corpus de sentencias (`cases/`), la legislación (`laws/`) y `data/` están en `.gitignore`.
- Los datos viven en la rama `data` del repo privado [`JorgeMantinan/mantijudicial-data`](https://github.com/JorgeMantinan/mantijudicial-data). Solo el script `scripts/push-data.ps1` escribe en ese repo (push con `--force`).
- La identidad local (`data/identity.json`, con usuarios, hashes y MFA) y las sesiones nunca se versionan en `main`.
- La variable `MANTIJUDICIAL_ROOT` cambia la raíz del corpus (la usan `apps/web/lib/dataset.ts` y `pipeline/lib/paths.ts`); en local no hace falta definirla.

## Requisitos

- Node.js >= 20
- pnpm 11
- Corpus de datos (sentencias y leyes) disponible en disco, bien clonando `mantijudicial-data` o bien generando un corpus de juguete: `node scripts/crear-corpus-juguete.mjs <directorio>`
- Opcional: `AI_API_KEY` (compatible OpenAI) para enriquecimiento; sin ella se usa `opencode`

## Puesta en marcha

```bash
pnpm install
pnpm web                   # next dev en :3000
```

Pipeline (desde la raíz, `tsx`):

```bash
pnpm hygiene | extract | metadata | enrich | laws | match | patterns | search | vias | ingest | seed | eval | supplement | compare | escrito
pnpm audit:failed          # lista casos con extracción fallida
```

Ejemplos concretos:

```bash
pnpm eval -- --show
pnpm compare -- --a=case_000034
pnpm escrito -- --a=case_000034 --tipo=RECURSO_CASACION
pnpm ingest -- --file=X.pdf --skip-enrich   # subir caso sin gastar en IA
```

Build de producción:

```bash
pnpm exec next build       # o pnpm --dir apps/web build
pnpm web:start
```

## Tests

```bash
pnpm typecheck             # tsc --noEmit (solo pipeline/; la web: pnpm --dir apps/web exec tsc --noEmit)
pnpm test                  # vitest: pipeline/lib/*.test.ts + apps/web/lib/*.test.ts
pnpm exec next build       # build de la web (incluye su typecheck)
```

CI (`.github/workflows/ci.yml`, push y PR a `main`): typecheck del pipeline, typecheck de `apps/web`, tests y build de la web con un corpus de juguete temporal (`scripts/crear-corpus-juguete.mjs` + `MANTIJUDICIAL_ROOT`).

## Variables de entorno

No hay `.env.example`; las variables documentadas son:

| Variable | Descripción |
|---|---|
| `MANTIJUDICIAL_ROOT` | Raíz del corpus (opcional en local; en Render apunta al disco persistente) |
| `AI_PROVIDER` | `http` (endpoint compatible OpenAI) u `opencode` (binario local) |
| `AI_API_KEY` | Clave del proveedor IA compatible OpenAI |
| `AI_BASE_URL` | Endpoint opcional (p. ej. `https://api.openai.com/v1`, OpenRouter, DeepSeek) |
| `AI_MODEL` | Modelo opcional (p. ej. `gpt-4o-mini`, `deepseek-chat`) |

Costes orientativos de IA: enriquecer caso ≈ $0,012; comparar ≈ $0,003; borrador de escrito ≈ $0,002.

## Despliegue

- Preparado para Render (`render.yaml`): servicio web con disco persistente de 5 GB; el bootstrap (`scripts/render-bootstrap.sh`) copia los datos desde `mantijudicial-data` al disco la primera vez.
- **No desplegado todavía.**
- Vercel: no usar (decisión del proyecto).

## Estado

- En desarrollo activo; el pipeline y la web compilan y pasan tests.
- Identidad hoy en `data/identity.json` sobre el disco: Supabase (SQL + RLS) está pendiente por cupo; `supabase/schema.sql` ya está listo.
- Búsqueda semántica con embeddings: bloqueada (el proveedor no los da).
- La subida de casos por la web siempre enriquece con IA (≈ 0,012 $/caso); para subir sin gastar usar el CLI con `--skip-enrich`.
