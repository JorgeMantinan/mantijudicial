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
245 tests + `next build` + `scripts/smoke.ps1` (33 comprobaciones).
