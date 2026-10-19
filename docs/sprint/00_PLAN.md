# Sprint de análisis de frases candidatas — plan de ejecución

> Objetivo del dueño (declarado 2026-10-18): en una ventana de **4 días**,
> **gastar los tokens de opencode** en analizar rigurosamente los 80 casos y
> mejorar los resultados para extraer **frases candidatas a resolver casos**.
> Este documento es el runbook de ese sprint. Empieza leyendo
> `docs/13_PARTE_ESTADO.md` + `AGENTS.md` (barato) y comprueba el estado con
> `node scripts/sprint/estado-sprint.mjs`.

## Política de coste del sprint (sustituye a la de2026-09-30 DURANTE EL SPRINT)

- **Autorizado**: todo análisis que corra con el proveedor `opencode` de
  `createAIProvider()` (es decir, con `AI_API_KEY` **sin definir** en el
  entorno: el provider cae a `opencode run` y consume tokens de suscripción).
- **Prohibido**: definir `AI_API_KEY` (eso gastaría dinero de API, no tokens).
- Al terminar el sprint, la política vuelve a la del parte de estado hasta
  nuevo aviso.
- Coste orientativo de referencia (de `review.json` real): reanalizar un caso
  completo ≈ **88 k tokens** (14 ficheros `structured/`). Los80 casos ≈ **7 M
  tokens** → planifica lotes según tu saldo (ver tabla de presupuesto más
  abajo y `estado-sprint.mjs`, que suma los tokens históricos).

## Pre-flight (día 0, barato — sólo comprobaciones)

1. `node scripts/sprint/estado-sprint.mjs` → debe decir `LISTO` (corpus,
   deps, tests). Regenera `docs/sprint/PROGRESO.md`.
2. `pnpm typecheck && pnpm test` en verde.
3. Copia de seguridad: `powershell -File scripts\backup.ps1`.
4. Corpus sincronizado con el repo privado (`scripts/push-data.ps1` tras cada
   jornada para no perder trabajo).
5. Sin `AI_API_KEY` en el entorno (verificar: `$env:AI_API_KEY` vacío).

## Fases del sprint

### Fase 1 — Línea base (medias antes de tocar nada)
- `pnpm eval -- --show` → métricas actuales por caso y global.
- `node scripts/sprint/estado-sprint.mjs` → guarda una copia de la tabla
  (`docs/sprint/PROGRESO.md`) como punto de partida.
- **Golden set (preparado el 2026-10-18)**: capa mecánica ya aplicada con
  `pipeline/sprint_golden.ts --aplicar` → **58 entradas confirmadas**
  (reglas de fallo + outcome.json + citas BOE concordantes con judgment.txt;
  ver `docs/sprint/GOLDEN_SET.md`; backups `cases/golden.json.bak-*`). Las
  **21 BAJA** (las reglas no detectan fallo) y la auditoría de las58 son
  trabajo del sprint con el protocolo forense de
  `.opencode/skills/golden-set/SKILL.md` — el dueño no valida a mano salvo
  que quiera veto explícito.

### Fase 2 — Reanálisis riguroso por lotes (el gasto principal)
- Lotes de **3–5 casos** por sesión del comando `/sprint`
  (`.opencode/commands/sprint.md`), rama por lote, PR o push directo a
  `main` según convenga (commits incrementales en inglés).
- Por cada caso, el agente sigue el rubric de
  `.opencode/skills/frases-candidatas/SKILL.md`: releer el texto del caso,
  validar/corregir `structured/`, y escribir
  `structured/frases_candidatas.json`.
- Si un lote revela un problema de prompt, se versiona el prompt
  (`prompt_version: enrich-v2`, …) en el PR del lote, no en mitad de un caso.

### Fase 3 — Mejora de resultados (prompts y validación)
- Iterar prompts sólo contra el golden set: `pnpm eval` antes/después de
  cada cambio; sin regresión numérica se hace merge.
- Esquemas: `pipeline/lib/enrich_schema.ts` es la fuente de verdad; los
  cambios de esquema exigen actualizar tests y re-validar los casos ya
  generados (`pnpm eval`).

### Fase 4 — Frases candidatas a escala
- Extraer/frases para los80 casos (Fase 2 ya las escribe por caso).
- Agregación: `pnpm search`/`pnpm patterns` sobre las frases; validar que
  las frases "de cajón" (stems de `pipeline/lib/frases.ts`) siguen filtradas.
- Entregable: informe por outcome con las frases más discriminantes y
  ejemplos de casos (ver esquema en el skill).

### Fase 5 — Cierre
- `node scripts/sprint/estado-sprint.mjs` final + actualizar
  `docs/13_PARTE_ESTADO.md` con el nuevo estado y la política de coste
  vigente.
- `scripts/push-data.ps1` (corpus a `mantijudicial-data`) + push de `main`.
- Etiqueta el resultado (p.ej. `git tag sprint-frases-YYYYMMDD`).

## Convención de resultados (para poder agregarlos después)

- Por caso: `cases/<id>/structured/frases_candidatas.json` (esquema en el
  skill; SIEMPRE con bloque `extraction` como el resto de `structured/`).
- Diario del sprint: `docs/sprint/DIARIO.md` (append-only: fecha, lote,
  casosa afectados, hallazgos de prompt, decisiones).
- Progreso de hechos: regenerado por `estado-sprint.mjs` (no editar a mano).

## Reparto de trabajo en paralelo (opcional)

- Default: **secuencial** por lotes (un solo agente, sin carreras sobre
  `cases/`).
- Paralelo: worktrees (`git worktree add`) con **particiones disjuntas de
  casos** (cada worktree sólo escribe sus casos) y `MANTIJUDICIAL_ROOT`
  apuntando al corpus común en disco (los worktrees no versionan `cases/`).
  Nunca dos agentes sobre el mismo caso.

## Presupuesto orientativo (tokens opencode)

| Lote | Casos | Tokens aprox. |
|---|---|---|
| Lote pequeño | 3 | ~265 k |
| Lote medio | 5 | ~440 k |
| Corpus completo | 80 | ~7 M |

(El bloque `tokens.total` histórico está en cada `cases/*/structured/review.json`;
`estado-sprint.mjs` los suma.)

## Qué NO se toca en el sprint

- Render ni Supabase (siguen olvidados salvo aviso explícito).
- `data/identity.json` y sesiones: nunca se versionan ni se suben.
- El corpus de producción sólo se modifica por los CLIs del pipeline o por
  edición explícita del dueño.
