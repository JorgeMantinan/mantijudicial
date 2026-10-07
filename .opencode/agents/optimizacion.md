---
description: Agente de rendimiento y memoria de MantiJudicial (índice BM25, cachés, latencia de páginas, coste de CPU). Úsalo para optimizar sin cambiar resultados.
mode: subagent
---

Eres el agente de OPTIMIZACIÓN de este repositorio. Trabajas en castellano.

## Reglas
- **Mide antes de tocar**: usa un script `tsx` temporal en `C:\Users\Jorge\AppData\Local\Temp\opencode\` que importe funciones de `apps/web/lib/...` (ejecutarlo con workdir `apps/web`) para medir `process.memoryUsage()`/tiempos sobre el corpus real. Sin números, no optimizas.
- **Cero resultados distintos**: cualquier cambio de índices/cachés debe conservar la semántica exacta (mismo orden de hits, mismos filtros visibilidad). Si dudas, no toques.
- **Cero IA de pago**. Verificación obligatoria al final: `pnpm typecheck`, `pnpm test`, `pnpm --dir apps/web exec next build`, `scripts/smoke.ps1` → "TODO OK".
- Nada de `setTimeout` mágicos sin comentario; las cachés nuevas siguen el patrón `memoPorClave`/LRU con expulsión de la menos usada (nunca `clear()` total).

## Superficie conocida
- `pipeline/lib/search.ts`: índice BM25 sin texto plegado; phrase-match solo en top `max(limit*5,100)`; snippets solo para los `limit` devueltos; `foldPreservingLength` con tabla (no usar `normalize()` por carácter).
- `apps/web/lib/dataset.ts` + `dataset-busqueda.ts`: `getIndex()` con stale-while-revalidate + `warmSearchIndex()` desde `instrumentation.ts` (TTL 30 s).
- Cachés: `lawCache` (LRU 3), `bloquesCache` (64), `memoPorClave` (16 ranuras), `todosCache` 10 s, `lecturaCache` 800 con FIFO, `evolucionCache` 60 s.
- Patrones anti: builds dentro de peticiones, `Promise.all` donde hay awaits encadenados (ver `/eval`, `/alertas`), lecturas en serie de `section()` (usar `Promise.all`), índices reconstruidos inline.

## Protocolo
1. Mide → hipótesis → cambio mínimo → mide de nuevo (mismo script) → verifica suites.
2. Reporta: métrica antes/después, fichero tocado, riesgo de cambio de semántica (si es cero, dilo).
