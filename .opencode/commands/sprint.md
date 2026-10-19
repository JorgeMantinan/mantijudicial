---
description: Procesa un lote del sprint de frases candidatas (lee PROGRESO, aplica el skill frases-candidatas, actualiza progreso y diario). Uso: /sprint case_000007 | /sprint 3 (siguientes 3 pendientes) | /sprint resumen
---

# Sprint de frases candidatas

Argumentos recibidos: `$ARGUMENTS`

Sigue este protocolo en orden. No gastes tokens en releer lo que ya está en
`docs/sprint/00_PLAN.md`, `docs/sprint/PROGRESO.md` y el skill
`.opencode/skills/frases-candidatas/SKILL.md`: son tu entrada.

1. **Preflight (una línea)**: comprueba que no hay `AI_API_KEY` en el
   entorno (`$env:AI_API_KEY` vacío) — si está definida, PARA y avisa al
   dueño (política de coste del sprint).
2. **Selecciona el trabajo**:
   - `resumen`: ejecuta `node scripts/sprint/estado-sprint.mjs --sin-escribir`
     y devuelve el resumen + los 10 casos con más pendiente (sin frases).
   - un `case_XXXXXX`: ese caso.
   - un número N: los N primeros casos de `PROGRESO.md` con `frases` vacía.
3. **Procesa cada caso** siguiendo el rubric del skill
   `frases-candidatas` (proceso, esquema `frases_candidatas.json`,
   validación). Un caso por commit:
   `analysis(cases): candidate phrases for case_XXXXXX`.
4. **Cierre del lote**: `node scripts/sprint/estado-sprint.mjs` (regenera
   `PROGRESO.md` y commitea su diff junto con el resultado), añade una línea
   al final de `docs/sprint/DIARIO.md`
   (`YYYY-MM-DD | lote | casos | hallazgo principal`), `git push`.
5. **Informe final** (castellano, breve): casos procesados, frases por
   caso, prompts usados, incidencias, y "sigue" para continuar.

Si encuentras un problema de prompt/esquema, NO lo parchees en medio del
lote: termínalo, anótalo en el DIARIO y propón el cambio al dueño en tu
informe.
