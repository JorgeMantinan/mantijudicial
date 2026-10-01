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

- **Regla del dueño (2026-09-30, hasta nuevo aviso): NO se gasta IA de pago
  salvo que él la lance desde la aplicación web.** Es decir:
  - Prohibido para el agente: `pnpm enrich|vias|compare|escrito` ni nada que
    llame a `opencode run`; ningún análisis de documentos por iniciativa propia.
  - Permitido: lo que **el usuario pulsa en la web** (subir caso, reanalizar,
    comparar…), que es su dinero y su decisión.
  - La conversación del agente se mantiene barata: respuestas cortas, comandos
    agrupados, sin releer ficheros sin necesidad.
- **Render y Supabase: no tocar hasta su aviso explícito.** Olvidado por ahora.
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


## Ampliaciones posteriores (mismo dÃ­a)

- Login con descripciÃ³n de la plataforma; buscador permanente en la cabecera;
  tema claro/oscuro con persistencia; chips de filtros en `/cases`; base de
  accesibilidad (skip-link, foco visible).
- CSV de prÃ¡cticamente todo: casos, informe (con filtros), temas, alertas y
  `/eval` (99 mÃ©tricas).
- `/temas/comparar` (dos temas lado a lado), `/resumen` imprimible,
  "PDFs con problemas" en `/alertas`, actividad del caso en su ficha, sumario
  del dossier y guÃ­a paso a paso del MFA en `/users`.
- `/evolucion` con filtros de rama y resultado; `/review` con progreso por rama
  y **aislamiento corregido** (ya filtra con `canViewCase`); `/informes` con
  filtros de rama/resultado; `/eval` con coste en vivo, calidad, sistema y
  tiempos de render.
- `dataset.ts` partido en `dataset.ts` + `dataset-estado.ts` (mismos imports).
- `scripts/smoke.ps1` ampliado: comprueba tambiÃ©n `/review` con carlos.

**Sigue pendiente**: activar el MFA de la cuenta admin (tÃº lo decides),
Supabase/Render cuando quieras pagarlos, y las ideas de la lista anterior.

## Ãšltimos retoques (cierre de la sesiÃ³n)

- Filtros de rama/resultado tambiÃ©n en `/temas/[topic]` (y su CSV los
  respeta); chips de filtros en `/informes`; paginaciÃ³n en `/search`.
- Dossier del cliente con la secciÃ³n de **vigencia de las leyes citadas**.
- Densidad de tablas (conmutador "Compacto/CÃ³modo" en la cabecera) y
  sugerencias en `/search` cuando no hay resultados (temas afines + enlace a
  legislaciÃ³n).
- Barrido de TODO/FIXME/console: sin deudas (coincidencias falsas).
- `scripts/smoke.ps1` = 33 comprobaciones.

**Estado final**: todo verde (`tsc` Ã— 2, 241 tests, `next build`, smoke) y
`main` al dÃ­a en GitHub. Siguiente sesiÃ³n: leer este parte + `AGENTS.md`.