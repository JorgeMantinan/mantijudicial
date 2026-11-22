# Parte de estado — 2026-09-30

Para **arrancar una sesión nueva barata**: léete esto + `AGENTS.md` y sigue con
la lista de pendientes. No hace falta releer el historial.

## Sprint de frases candidatas — CERRADO (2026-11-21)

- **Frases**: 80/80 casos con `structured/frases_candidatas.json` → **592
  frases** verbatim (463 ALTA, 129 MEDIA; 315 CRITERIO, 158 DOCTRINA, 105
  RAZONAMIENTO, 14 DECISION), rubric `frases-v1`, proveedor `opencode`,
  **coste 0** (ventana de 4 días autorizada: 2026-11-20/21).
- **Entregable para letrados**: `docs/sprint/INFORME_FRASES.md` — frases
  agrupadas por outcome (ESTIMED / PARTIALLY_ESTIMATED / DISMISSED) con
  `por_que` y fuente; punto de partida para afrontar casos nuevos.
- **Golden set**: 78/79 confirmadas (20 verificadas en profundidad el
  2026-11-20 con cita del dispositivo); `case_000032` sin confirmar (la
  casación no se resolvió). `docs/sprint/GOLDEN_SET.md`.
- **Validación**: script propio → 0 errores de esquema, 0 avisos de
  verbatim (19 falsos positivos por andamiaje del extractor resueltos;
  3 correcciones reales: 000003, 000010, 000061). `pnpm patterns`
  refrescado (`cases/patterns.json`, 79 casos).
- **Política de coste vigente**: FIN de la ventana de sprint → vuelve la
  regla del 2026-09-30: **NO gastar IA de pago salvo que el dueño la lance**.
  `case_000056` sigue excluido (extracción corrupta; NO reintentar).
- Trazas: `docs/sprint/DIARIO.md`, `docs/sprint/PROGRESO.md`, backups
  `cases/golden.json.bak-2026-11-20` + 20 `review.json.bak-*`, tag
  `sprint-frases-20261121`.

## Enriquecimiento v2 — CERRADO (2026-11-22)

- **79/79 casos re-enriquecidos con `enrich-v2`** (76 en tandas normales +
  3 recuperados; `000032` y `000072` acabados con `mimo-v2.6-pro` tras
  cortes repetidos del backend). `case_000056` sigue excluido.
- Cambios del prompt v2: quotes **literales del documento**, `boe_id` solo
  de una lista blanca del catálogo, y solo preceptos citados en el texto.
- Resultados (antes → después): ids inventados **377 → 0**, contradichos
  **374 → 0**, quotes MATCH **481 → 1161 (95%)** y MISMATCH **44 → 29**,
  `ARTICLE_NOT_FOUND` 23 → 10, `TEXT_MISSING` 45 → 17.
- **Golden 355/355 (100%)** tras corregir4 expect CE falsas
  (`000035/000042/000045/000065`: sufijos europeos «(CE)», «ce contrat»,
  «ceñirse» — backup `golden.json.bak-2026-11-22`) y **endurecer el
  detector CE** de `siglas.ts` (mayúsculas, guarda «(CE)» y salto de
  línea). Cruce reglas↔IA **78/78**; frases **592 intactas** (0 avisos).
- Incidencias resueltas en el camino: cortes del backend (4 rondas de
  reintentos; ~45 min por timeout), 2 reinicios de servidor sin daños,
  `moveLegacyStructured` archivaba productos de otros pasos y
  `notes.json` (corregido + restaurado), binario opencode movido a
  `@opencode/cli`, flags `review.golden` restaurados (78).
- Nota de coste: los `review.json` de v2 no reportan tokens (opencode
  suscripción) → el histórico de enrich ($0,92 / 6,86 M tokens) queda en
  este documento y en el historial git de `data`; el resto de costes
  (`vias` $0,51) sigue en `/eval`. Sin `AI_API_KEY`.
- Conocido: la IA v2 sobrecita «Constitución» en ~26 casos (flagados en
  el cross-check, 97,1%) — candidato a prompt v2.1 si interesa.
- **Ampliación v2.1 (2026-11-22)**: reglas añadidas (solo citar CE con
  cita formal; «article» con número si consta en el documento) y
  re-enriquecimiento **80/80 en3 rondas** con auto-reintentos. Resultado:
  siglas en PDF **97,1% → 100% (948/948)** — ruido CE eliminado —,
  golden **355/355**, cruce **79/79** (`case_000056` por fin enriquecido
  OK y concordante), inventados/contradichos **0**, frases **592
  intactas**, flags **78/78**. Artefactos derivados (vias/compare/
  escrito) en regeneración sobre v2.1 (tanda-force.mjs).

## Estado del proyecto

- Todo verde: `pnpm typecheck` (solo `pipeline/`), `pnpm --dir apps/web exec
  tsc --noEmit` (ya con `noUnusedLocals`), `pnpm test` (324 tests),
  `pnpm --dir apps/web exec next build` y `powershell -File scripts\smoke.ps1`
  (32 comprobaciones: rutas, CSV y aislamiento con carlos).
- `main` al día en GitHub. Ramas: `main` = solo código · `data` = corpus +
  identidad sin sesiones (se refresca con `scripts/push-data.ps1`).
- **CI**: `.github/workflows/ci.yml` (push/PR a `main`): `pnpm typecheck` +
  `tsc` de `apps/web` + `pnpm test` + **`next build` con corpus de juguete**
  (`scripts/crear-corpus-juguete.mjs` en un temporal y `MANTIJUDICIAL_ROOT`
  apuntando allí: el runner limpio no tiene `cases/`).
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

## Calidad y deuda técnica (2026-10-07, local, sin despliegue)

- **Tests**: +28 en las 7 libs de `pipeline/lib` que no tenían (`boe_api`,
  `schema`, `signals`, `siglas`, `prompt`, `paths`, `enrich_schema`) → 324 en
  total. Ninguna se omitió: `boe_api` se prueba con `fetch` falso (sin red) y
  `paths`/`signals` con un corpus temporal vía `MANTIJUDICIAL_ROOT`.
- **Locales sin uso borrados**: 23 marcados por `tsc --noUnusedLocals` (13
  `orgId` de `defaultOrgId()` en rutas de `app/api/*`, comprobados uno a uno:
  la llamada no se usaba en ninguna), más `ArgRow`/`rows` de `/patterns` que
  quedaron huérfanos. `apps/web/tsconfig.json` activa ya `noUnusedLocals`.
- **`docs/11` §1.4**: ya no es "8 casos 100 % CONTRACTUAL"; distribución real
  recalculada (script tsx temporal sobre `cases/*/structured/classification.json`):
  de 79 enriquecidos, CONTRACTUAL 22 (27,8 %), CIVIL_LIABILITY 18,
  CONSUMER_ABUSIVE_CLAUSES 17, LEASE_PROPERTY 9, PROPERTY_COMMUNITY 6,
  COMMERCIAL 5, OTHER 1, PROCEDURAL 1 (FAMILY y SUCCESSIONS, 0).
- **`docs/12` checklist**: marcados los 5 ímites verificables en local (repo
  privado vía `gh`, `data/` fuera de `main` y sin sesiones en la rama `data`,
  cookie `secure` en producción, aviso de IA en el pie de `layout.tsx` y BOE
  "meramente informativo"). Siguen abiertos: MFA (0 de 3 usuarios locales con
  MFA activo), HTTPS/backup de Render (sin desplegar) y RGPD.

## Pendientes / ideas no hechas

- [ ] MFA del administrador apagado (aviso en `/users`; activarlo cuando quieras).
- [ ] Supabase (identidad SQL) y embeddings: sin cupo/proveedor → ver `docs/11`.
- [ ] Despliegue en Render cuando decidas pagar el plan con disco (`docs/12`).
- [ ] Ideas descartadas por ahora: export DOCX (requiere dependencias), split
  más fino de `dataset.ts` (ya partido en `dataset-estado.ts`).
- [ ] Posibles siguientes: comparar dos temas, ordenar más
  tablas con `SortTh`, métricas de rendimiento por página.

## Mapa rápido

- Navegación: Resumen · Casos · Revisión · Alertas · Informes | Evolución ·
  Búsqueda · Legislación · Patrones | Plazos · Evaluación · Ayuda · Usuarios.
- Extras enlazados desde la portada: `/temas/[tema]`, `/resumen`,
  `/novedades`, `/informes` (A vs B), dossier y comparación por ficha.
- Credenciales demo y trampas de Windows: en `AGENTS.md`.


## Ampliaciones posteriores (mismo día)

- Login con descripción de la plataforma; buscador permanente en la cabecera;
  tema claro/oscuro con persistencia; chips de filtros en `/cases`; base de
  accesibilidad (skip-link, foco visible, títulos de pestaña por ruta).
- CSV de prácticamente todo: casos, informe (con filtros), temas, alertas y
  `/eval` (99 métricas).
- `/temas/comparar` (dos temas lado a lado), `/resumen` imprimible,
  "PDFs con problemas" en `/alertas` (con explicación de cómo reanalizarlos),
  actividad del caso en su ficha, sumario del dossier y guía paso a paso del
  MFA en `/users`.
- `/evolucion` con filtros de rama/resultado y orden en sus dos tablas;
  `/review` con progreso por rama, tablas ordenables y **aislamiento corregido**
  (filtra con `canViewCase`); `/informes` con filtros de rama/resultado y
  orden en temas/matriz/normas; menú rediseñado en dos filas con píldoras.
- `dataset.ts` partido en `dataset.ts` + `dataset-estado.ts` (mismos imports).
- 404 en castellano, botones "copiar" (artículo, enlace de caso, conclusión),
  páginas imprimibles completas (ficha, dossier, comparación, alertas,
  informes, resumen, temas, evolución, revisión, patrones, calidad, norma).

## Patrones de frases (sección de /patterns)

- Fuente: hechos (`facts`), fundamentos (`holdings`) y **alegaciones de las
  partes** (`arguments`), separados en **tres tablas** (Frases de: Hechos /
  Fundamentos / Alegaciones).
- Filtros: mínimo 5 tokens significativos; vocabulario de cajón fuera por
  prefijo (`desestim*`, `cost*`, `deposit*`, `formul*`, `oposicion*`,
  `confirm*`, `revoc*`, `casacion*`, `condena*`, `apelacion*`); solape de
  tokens ≥ 0,5; mínimo 3 casos; **homogeneidad ≥ 70 %** con badge "% igual"
  (ordenados por homogeneidad).

## Uso de IA autorizado (2026-09-30)

- **Autorizado y ejecutado**: enriquecer los 4 casos que faltaban a 0,012 $
  el caso. Resultado: **79/80 enriquecidos** (PDFs stale = 0).
  - `case_000012` OK ($0,0070) · `case_000041` OK ($0,0084) ·
    `case_000057` OK ($0,0174, hubo 1 reintento).
  - `case_000056`: **dejado tal cual por decisión suya (2026-09-30)** — el
    modelo devuelve JSON inválido de forma repetida y se considera "corrupto".
    **NO reintentar nunca** sin permiso nuevo. Ya se gastaron ≈ $0,03 en
    intentos fallidos.
- Gasto total de esta tanda: ≈ **$0,06** (presupuesto teórico $0,048).

## A final de mes (instrucción suya, 2026-09-30)

Cuando **él lo pida expresamente**, gastar los tokens restantes del mes en lo
más útil, por este orden (y siempre avisando antes del coste estimado):

1. Comparaciones (`compare`) de los casos más citados/descargados ≈ $0,003 c/u.
2. Vías de actuación para los casos sin `vias.json` ≈ $0,003 c/u.
3. Nada de re-enriquecer lo ya OK salvo que cambie el PDF.
4. `case_000056` queda fuera (descartado como corrupto).

**Hasta su "ahora sí": no gastar nada.**

## Tandas de cierre (posteriores, sin IA de pago)

- **Patrones de frases**: 5 orígenes (hechos, fundamentos, alegaciones,
  pretensiones, cronología), columnas de instancia y ramas, umbral de
  homogeneidad ≥70%, vocabulario de cajón fuera por prefijo, ficha drill-down
  (`/patrones/frase`), CSV y "ya lo he visto" en alertas.
- **Clientes/encargos**: alta en la ficha, filtro y chips en `/cases`, columna
  en el CSV, panel `/clientes` (ordenable) con ficha de cliente
  (`/clientes/[nombre]`), CSV del panel y enlace desde portada/ayuda.
- **Informes**: frases del periodo (matriz con n estimados/desestimados por
  periodo), incorporadas al corpus por fecha de análisis, alertas del periodo.
- **Alertas**: histórico diario (`data/alertas_historial.json`, 180 días) y
  "casos nuevos que encajan con tus búsquedas guardadas".
- **Vistas guardadas** en `/cases` (`data/vistas_guardadas.json`).
- Navegación con píldoras y pestaña activa; 404 en castellano; todo lo
  imprimible con botón; `AGENTS.md` al día.

Verificación de esta etapa: `pnpm typecheck` (pipeline) + `tsc` de `apps/web` +
291 tests + `next build` + `scripts/smoke.ps1` (32 comprobaciones).

## Auditoría de ciberseguridad y calidad (2026-09-30/10-01)

Hecha con dos revisores en paralelo (seguridad y rendimiento/código) y
aplicada por tandas. Commits: `0f87ebb`, `2f95a16`, `d6b05fe`, `7136ffb`,
`e87bfa6`, `6c5d960`.

**Corregido (seguridad):**
- Rate limiting en login (5/15 min por IP+correo) y MFA (10/15 min); el 429
  solo corta si el intento falla → quien tiene la clave correcta nunca queda
  bloqueado.
- `/api/users`: `firmId` restringido a tus despachos (antes un admin podía
  crear usuarios en otro despacho) y listados filtrados.
- IDOR: `/api/archivar`, `/api/clientes` y `DELETE /api/notes` exigen permiso
  sobre el caso.
- Cross-tenant: `/temas/comparar`, `/clientes` (+CSV), `/eval` (+CSV),
  `/api/jobs` y `GET /api/ingest` filtran con `canViewCase`; `/users` solo
  muestra la auditoría de tus despachos; cabecera de revisión solo con actor
  real.
- CSV: neutralización de fórmulas (`=`, `+`, `-`, `@`) en las 8 exportaciones.
- Cabeceras: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-
  Policy, HSTS y **CSP con nonce por petición** en `proxy.ts` (sin
  `unsafe-inline` en `script-src`).
- `docs/12` sin credenciales de demo (rotar al desplegar).

**Propiedad de despacho (tu regla):**
- `data/casos_org.json`: cada caso guarda la firma que lo subió;
  `canViewCase` resuelve el dueño real (síncrono, caché 5 s). Sin registro,
  comportamiento heredado (corpus antiguo = primer despacho).
- Estados por despacho en `data/org/<firmId>/`: busquedas, vistas guardadas y
  patrones vistos (probado: admin y carlos no se pisan).

**Rendimiento:** caché en `getLaw` (evita reparsear 3,5-6,5 MB por
referencia) y en `computePatterns` (evita 640 lecturas/render).

**Limpieza:** `CompareReport` importado de `@pipeline/compare`; miga de pan
real de `/laws` (antes O(n²) y nunca visible).

**Pendientes de la auditoría (no urgentes):**
1. ~~Centralizar `csv()`~~ ✅ hecho: `lib/csv.ts` y las 8 rutas lo importan.
2. ~~Avisos en `readJson`~~ ✅ hecho: `console.warn` salvo `ENOENT`.
3. ~~Cadena de hash en `audit.log`~~ ✅ hecho: `sha256(previo+contenido)` por
   entrada y badge "integridad OK (N)" en `/users`.
4. ~~Caché de `getInforme`~~ ✅ hecho: lecturas crudas con `memoClave`
   (60 s); /informes pasó de 1136 ms a 74 ms.
5. ~~Limpieza fina~~ ✅ hecho: `fechaEs`/`cortar` únicos en
   `lib/texto.ts` (migrados 3 + 5 usos con script) y `PAPELES` en
   `labels.ts`.

**Fuera de alcance decidido:** Supabase y Render (hasta su aviso), embeddings
(proveedor no los da).
