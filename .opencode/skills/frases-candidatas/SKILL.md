---
name: frases-candidatas
description: Use cuando toque analizar un caso del corpus (cases/case_XXXXXX) para extraer o mejorar sus frases candidatas a resolver casos, o cuando el comando /sprint pida procesar un lote. Fija el proceso, el rubric de calidad y el contrato del fichero de salida structured/frases_candidatas.json.
---

# Frases candidatas — rubric de análisis

## Qué es una frase candidata

Frase **verbatim** del caso (sentencia, fundamentos o jurisprudencia citada)
con valor de **criterio**: una que, traída a otro caso semejante, pueda
fundamentar el fallo. NO cuentan:

- frases de cajón (los stems de `pipeline/lib/frases.ts`: desestim…, costas…,
  depósito…, confirm…, etc.) ni fórmulas de estilo ("esta Sala", "en
  atención a lo expuesto");
- hechos puros sin carga argumentativa ("el demandante interpuso demanda");
- texto inventado o parafraseado: **cita textual** con su localizador.

## Proceso por caso (en este orden)

1. Contexto barato: `cases/<id>/structured/review.json` (prompt/modelo
   actuales) y `classification.json` + `outcome.json` (rama, fallo).
2. Leer el texto del caso en `cases/<id>/` (estructura en
   `docs/09_CASE_DATA_MODEL.md`) y, si existe, `reasoning.json` y
   `arguments.json` ya enriquecidos.
3. Extraer 3–10 frases candidatas por caso (calidad > cantidad). Para cada
   una: verbatim exacto, tipo, por qué sirve, y de dónde sale (fichero +
   localizador: párrafo, página o fragmento que la ancle).
4. Escribir `cases/<id>/structured/frases_candidatas.json` con el esquema
   siguiente. SIEMPRE incluir el bloque `extraction` igual que el resto de
   ficheros de `structured/`:

```json
{
  "case_id": "CASE-000001",
  "frases": [
    {
      "texto": "Texto exacto de la frase, entrecomillado tal cual aparece.",
      "tipo": "DOCTRINA | CRITERIO | RAZONAMIENTO | DECISION",
      "relevancia": "ALTA | MEDIA | BAJA",
      "por_que": "Una frase en castellano: en qué tipo de caso serviría y con qué fundamento.",
      "fuente": { "archivo": "reasoning.json", "localizador": "párrafo 4 / pág. 12 / fragmento: …" }
    }
  ],
  "extraction": {
    "provider": "opencode-cli",
    "model": "<modelo de la sesión>",
    "prompt_version": "frases-v1",
    "generated_at": "<ISO>",
    "input_chars": 0,
    "tokens": { "input": 0, "output": 0, "total": 0 },
    "cost": 0,
    "validation": "OK",
    "schema_errors": []
  }
}
```

5. Validar leyendo el fichero escrito (JSON parseable, campos obligatorios,
   `case_id` coincide con el directorio). Si algo no cuadra: `validation`
   `"REVISAR"` y anota los problemas en `schema_errors`.
6. Si el lote cambia un prompt del pipeline, versionarlo (`frases-v2`,
   `enrich-v2`) y dejarlo explícito en el commit; nunca reescribir prompts
   en mitad de un caso sin re-ejecutar `pnpm eval`.

## Disciplina del lote

- Un commit por caso como máximo, tipo
  `analysis(cases): candidate phrases for case_000001` (inglés, convencional).
- No tocar `review.json` (review/golden es decisión del dueño) ni ningún
  `structured/` distinto del caso del lote.
- Sin `AI_API_KEY` en el entorno: todo el análisis va con el proveedor
  `opencode` (tokens de suscripción; `cost: 0`). Nunca inventar dinero.
- Trampas de Windows/PowerShell y de encoding: ver `AGENTS.md`
  (nunca `Set-Content` en `.ts`/`.json`; usar la herramienta Edit o
  `WriteAllText` UTF-8 sin BOM).
- Tras el lote: `node scripts/sprint/estado-sprint.mjs` (regenera
  `docs/sprint/PROGRESO.md`), append en `docs/sprint/DIARIO.md` y push.

## Criterios de aceptación (autocheck antes de dar el lote por terminado)

- [ ] `frases_candidatas.json` parseable y con `extraction` completo.
- [ ] Cada frase es verbatim y tiene localizador localizable.
- [ ] Ninguna frase de cajón (repasar los stems de `frases.ts`).
- [ ] El `case_id` del fichero coincide con el del directorio.
- [ ] `pnpm test` sigue verde si se tocó código del pipeline (no debería
      tocarse en un lote de análisis).
