---
name: golden-set
description: Use cuando toque verificar, confirmar o mantener el golden set (cases/golden.json) del corpus judicial — p.ej. durante el sprint de frases, al promover entradas MEDIA/BAJA, o si un cambio de prompt exige revalidar la ground truth. Fija el protocolo forense de verificación y las reglas de integridad.
---

# Golden set — protocolo de verificación forense

## Rol

El agente actúa como **verificador de fidelidad de extracciones judiciales**,
no como jurista: certifica que la ground truth (`cases/golden.json`)
refleja lo que **el documento dice**, sin emitir opinión jurídica. El dueño
no es abogado ni juez — esta skill es su sustituto procedimental: si la
verificación exige interpretar derecho (¿es doctrina vinculante?, ¿la rama
es correcta como categoría?), se deja **sin confirmar** con nota explicativa.

## Jerarquía de fuentes de verdad

1. `cases/<id>/original/*.pdf` (el documento del tribunal).
2. `cases/<id>/extracted/judgment.txt` (texto extraído del PDF).
3. La **sección FALLO / parte dispositiva** (últimas páginas) manda sobre el
   resto del texto para el `outcome`.
4. `cases/<id>/structured/*` es la **hipótesis de la IA**: NUNCA es fuente
   para confirmar; si contradice al documento, falla la IA, no el golden.

## Escalera de confianza (mismos términos que `pipeline/sprint_golden.ts`)

- **ALTA** — reglas del fallo, `outcome.json` y citas BOE concordantes con
  `judgment.txt` → confirmable mecánicamente.
- **MEDIA** — concordancia parcial (discrepancia IA↔reglas, citas
  faltantes, headline ausente) → verificación profunda de este protocolo.
- **BAJA** — desacuerdo claro o texto ilegible → corregir la extracción
  (Fase 2/3 del sprint) antes de tocar el golden.

## Protocolo profundo (por caso, para MEDIA/BAJA o auditoría)

1. Abrir el PDF (dispositivo al final) y localizar el **fallo literal**.
2. Outcome: mapear el dispositivo al enum del pipeline:
   estimar íntegramente → `ESTIMED`; desestimar (recurso/demanda) →
   `DISMISSED`; estimación parcial → `PARTIALLY_ESTIMATED`; si el fallo es
   ambiguo o acumulado con acumulación de recursos → `UNKNOWN` y **no
   confirmar**.
3. Citas BOE: para cada `must_cite_boe_ids`, localizar en el texto la cita
   y comprobar que la norma citada es efectivamente esa (id ↔ sigla ↔
   contenido). Una id correcta por azar no basta: debe haber frase que la
   cite.
4. `civil_branch`: confirmar SÓLO si el texto lo dice explícitamente
   ("acción contractual", "responsabilidad extracontractual", "arrendamiento
   de vivienda", etc.). Si hay duda → dejar el campo sin confirmar (la
   ausencia de expect no penaliza a la IA; una expect errónea sí la
   castigaría injustamente).
5. `headline_contains`: debe ser substring real del texto (normalizado).
6. `min_holdings` / `min_facts`: no bajar los valores ya fijados; subirlos
   sólo si el documento muestra claramente más elementos de los contados.
7. Anotar en `notes` con **cita textual corta** del fallo (≤20 palabras)
   que justifique la verificación. Ejemplo:
   `"Verificado: 'se desestima el recurso de casación interpuesto' (dispositivo)"`.

## Reglas de integridad (inviolables)

- Nunca editar `structured/` para cuadrar con el golden: el flujo es al
  revés (golden fijo → la IA se corrige en el sprint).
- `confirmed: true` sólo con evidencia textual citable. Ambigüedad →
  `confirmed: false` + `notes` con lo dudoso.
- `source`: `"human"` sólo si lo verifica el dueño; verificación por agente
  → mantener `"auto-rule"` y constatar la lectura profunda en `notes`.
- Backups antes de escribir: `cases/golden.json.bak-<fecha>` y, por cada
  `review.json` tocado, `review.json.bak-<fecha>` (lo hace
  `sprint_golden.ts --aplicar`; en ediciones manuales, copiar a mano).

## Flujo de trabajo

- Capa mecánica (reglas+IA+citas): `pnpm exec tsx pipeline/sprint_golden.ts`
  (propuesta) y `--aplicar` (confirma las ALTA + backups + marca
  `review.json.golden`). Informe: `docs/sprint/GOLDEN_SET.md`.
- Capa profunda (protocolo anterior): leer el fallo, y si procede confirmar
  editando `cases/golden.json` (o `pnpm eval -- --confirm=<caseId>` como
  ayuda interactiva). Sincronizar el flag de `review.json.golden`
  (`isGoldenDataset`, `groundTruthVersion: "golden-v1-agent"`,
  `reviewedBy`, `reviewedAt`) — la web lo lee.
- Medición: `pnpm eval` antes/después de cualquier cambio de prompt; sin
  regresión numérica no se mergea.

## Tamaño y diversidad del set

- Objetivo: **15–25 casos confirmados** representativos (reparto entre
  `ESTIMED`/`DISMISSED`/`PARTIALLY_ESTIMATED` y ramas civiles presentes en
  `classification.json`). Confirmar los80 no aporta medida mejor y sí más
  mantenimiento.
- Ante empate, priorizar: fallo corto y nítido > fallo largo con
  acumulación; con citas verificables > sin citas; `finality_status: FIRM`
  > recursos pendientes.
