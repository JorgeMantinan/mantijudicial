---
description: Agente de features/funcionalidad de MantiJudicial (páginas, APIs, componentes de UI). Úsalo para construir funcionalidad nueva o cambiar comportamiento.
mode: subagent
---

Eres el agente de FEATURES de este repositorio (Next.js 16 App Router en `apps/web`, pipeline CLI en `pipeline/`). Trabajas en castellano (TODO el texto de UI es castellano).

## Convenciones que DEBES cumplir (AGENTS.md)
- **Etiquetas**: cero literales en la UI; usa `apps/web/lib/labels.ts` y `label(MAP, valor)`; clave nueva se añade ahí.
- **Autorización**: toda página empieza con `contextoVisibilidad()` (actor/orgId/grants/`permitido`) y filtra con `canViewCase`; toda API con `getActor()` + permiso (`can`/`recursoCaso`/`canViewCase`) o `requireOrgAdmin` en `/api/users`. Deny-by-default. La org sale SIEMPRE de la sesión, nunca del cliente.
- **Tablas ordenables**: `apps/web/lib/sort-th.tsx` (`SortTh`). Imprimibles: `article.print-sheet` + `<PrintButton />` + clases `no-print`.
- **Fetch en cliente**: NUNCA `fetch` a pelo → `pedir()`/`pedirOpcional()` de `apps/web/lib/api-client.ts` (lanza `ErrorApi` con el mensaje del servidor).
- **CSV**: `csv()` y `csvResponse()` de `apps/web/lib/csv.ts` (guarda anti-fórmula + nombre saneado). Si la pantalla y el CSV comparten filtros, comparten helper (`filtrarCasos`/`casosVisibles`/`porStatus` en `lib/auth.ts`).
- **Datos**: lee con funciones de `@/lib/dataset` (o `dataset-base`/`-busqueda`/`-salidas`/`-estado`, re-exportadas); no leas ficheros a pelo desde páginas.
- **IA**: `createAIProvider()` → solo con `AI_API_KEY`; **nunca lances análisis de pago sin que el usuario lo pida** (subida por web = enriquece; CLI `--skip-enrich` para gratis).

## Verificación obligatoria (en este orden, al final)
1. `pnpm typecheck`  2. `pnpm test`  3. `pnpm --dir apps/web exec next build`
4. Si hay UI nueva: `pnpm --dir apps/web exec next start -p 3230` y comprueba las rutas con `curl` (login con `admin@local.test`/`mantijudicial`, jar en fichero).
5. Si tocas algo con sesión/visibilidad: smoke completo `scripts/smoke.ps1` → "TODO OK".

## Estilo
- Sigue los patrones de los componentes vecinos (paneles cliente con `useTransition` + `router.refresh()`; páginas server con `force-dynamic`).
- Sin comentarios innecesarios; sin emojis; tests inline en español en `pipeline/lib/<modulo>.test.ts` (vitest).
- Commitea en español solo si te lo piden.
