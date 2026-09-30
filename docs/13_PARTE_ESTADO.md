# Parte de estado — 2026-09-30

Para **arrancar una sesión nueva barata**: léete esto + `AGENTS.md` y sigue con
la lista de pendientes. No hace falta releer el historial.

## Estado del proyecto

- Todo verde: `pnpm typecheck` (solo `pipeline/`), `pnpm --dir apps/web exec
  tsc --noEmit`, `pnpm test` (241 tests), `pnpm exec next build` y
  `powershell -File scripts\smoke.ps1` (31 comprobaciones: rutas, CSV y
  aislamiento con carlos).
- `main` al día en GitHub. Ramas: `main` = solo código · `data` = corpus +
  identidad sin sesiones (se refresca con `scripts/push-data.ps1`).
- **Sin despliegue**: Render preparado (`render.yaml` + bootstrap) sin contratar;
  proyecto de Vercel borrado. Todo corre en local (`pnpm web`).
- Copias: `scripts/backup.ps1` (retención) y `restore.ps1` (verificado).

## Política de coste (importante)

- **No ejecutar CLIs de IA** (`pnpm enrich|vias|compare|escrito` ni nada que
  llame a `opencode run`) sin pedirlo explícitamente.
- Coste histórico ≈ **$0,90** (76 casos enriquecidos); a la vista en
  `/eval → Coste en vivo`.

## Cómo trabajamos

Lotes de 3 ideas → código → `tsc` web + `test` + `next build` → `smoke.ps1` →
`git commit` + `push` (solo GitHub) → resumen en castellano y "sigue".

## Pendientes / ideas no hechas

- [ ] MFA del administrador apagado (aviso en `/users`; activarlo cuando quieras).
- [ ] Supabase (identidad SQL) y embeddings: sin cupo/proveedor → ver `docs/11`.
- [ ] Despliegue en Render cuando decidas pagar el plan con disco (`docs/12`).
- [ ] Ideas descartadas por ahora: export DOCX (requiere dependencias), split
  más fino de `dataset.ts` (ya partido en `dataset-estado.ts`).
- [ ] Posibles siguientes: CSV de `/eval`, comparar dos temas, ordenar más
  tablas con `SortTh`, métricas de rendimiento por página.

## Mapa rápido

- Navegación: Resumen · Casos · Revisión · Alertas · Informes | Evolución ·
  Búsqueda · Legislación · Patrones | Plazos · Evaluación · Ayuda · Usuarios.
- Extras enlazados desde la portada: `/temas/[tema]`, `/resumen`,
  `/novedades`, `/informes` (A vs B), dossier y comparación por ficha.
- Credenciales demo y trampas de Windows: en `AGENTS.md`.
