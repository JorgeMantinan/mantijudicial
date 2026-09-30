# CASE_DATA_MODEL.md --- Estructura jurídica recomendada

## 1. Observación sobre el piloto

La estructura actual:

``` text
case/
├── metadata/
├── original/
└── structured/
    ├── facts.json
    └── arguments.json
```

es buena como estructura inicial de ingestión de jurisprudencia.

Pero es insuficiente como expediente jurídico completo.

------------------------------------------------------------------------

# 2. Nueva estructura conceptual

``` text
CASE
├── metadata
├── parties
├── claims
├── facts
├── evidence
├── timeline
├── documents
├── legal_sources
├── judicial_decisions
├── arguments
├── risks
├── counter_arguments
├── tasks
├── notes
├── ai_analyses
├── outcomes
└── audit
```

------------------------------------------------------------------------

# 3. Metadata

Debe contener:

-   referencia;
-   título;
-   área jurídica;
-   jurisdicción;
-   procedimiento;
-   juzgado;
-   número;
-   estado;
-   fase;
-   prioridad;
-   abogado responsable;
-   cliente;
-   despacho;
-   confidencialidad.

------------------------------------------------------------------------

# 4. Parties

Para cada parte:

-   nombre;
-   tipo;
-   posición;
-   representación;
-   abogado;
-   procurador;
-   cliente/no cliente;
-   observaciones.

------------------------------------------------------------------------

# 5. Claims

Cada pretensión debe ser independiente.

Ejemplo:

``` text
Claim 1
Resolución contractual

Claim 2
Devolución de cantidades

Claim 3
Indemnización
```

Cada una puede terminar de forma diferente.

------------------------------------------------------------------------

# 6. Facts

Cada hecho debe registrar:

-   descripción;
-   fecha;
-   parte que lo afirma;
-   estado;
-   fuente;
-   importancia;
-   contradicciones.

------------------------------------------------------------------------

# 7. Evidence

No asumir que todo documento es evidencia.

Una factura puede ser documento y evidencia de un hecho concreto.

Por eso:

Document → Evidence

puede ser una relación independiente.

------------------------------------------------------------------------

# 8. Timeline

Crear cronología automática y editable.

Ejemplo:

``` text
07/11/2017
Contrato

15/07/2018
Impago

30/07/2018
Burofax

07/08/2018
Pago

...
```

La IA debe poder consultar esta timeline.

------------------------------------------------------------------------

# 9. Argumentos

Separar:

-   quién lo afirma;
-   fundamento;
-   evidencia;
-   respuesta de la otra parte;
-   resultado.

------------------------------------------------------------------------

# 10. Riesgos

Entidad explícita:

`CaseRisk`

Campos:

-   title;
-   description;
-   severity;
-   source;
-   mitigation;
-   status;
-   reviewedBy.

------------------------------------------------------------------------

# 11. Información faltante

Entidad:

`MissingInformation`

Campos:

-   title;
-   description;
-   importance;
-   reason;
-   suggestedAction;
-   status.

Esto permite que la IA diga:

"Falta el contrato original."

en vez de limitarse a responder.

------------------------------------------------------------------------

# 12. Contraargumentos

Cada argumento importante debería poder tener:

``` text
Argumento propio
↓
Posible contraargumento
↓
Respuesta
↓
Evidencia
```

------------------------------------------------------------------------

# 13. Outcome

El resultado debe existir a nivel de:

-   caso;
-   pretensión;
-   argumento cuando proceda.

Ejemplo:

Caso: parcialmente ganado.

Claim 1: concedido.

Claim 2: rechazado.

Claim 3: parcialmente concedido.

------------------------------------------------------------------------

# 14. Recurso

Preparar estructura para múltiples instancias:

``` text
Case
├── Instance 1
├── Appeal
├── Supreme Court
└── Enforcement
```

No sobrescribir el resultado anterior.

------------------------------------------------------------------------

# 15. Relaciones

Preparar:

Case ↔ JudicialDecision

Case ↔ LegalArticle

Case ↔ Document

Case ↔ Evidence

Case ↔ Argument

Case ↔ Claim

JudicialDecision ↔ LegalArticle

JudicialDecision ↔ JudicialDecision

Esto permitirá construir un grafo jurídico posteriormente.

------------------------------------------------------------------------

# 16. Grafo futuro

El modelo debe permitir:

``` text
Hecho
  ↓
Prueba
  ↓
Argumento
  ↓
Norma
  ↓
Jurisprudencia
  ↓
Resultado
```

Esta estructura será muy valiosa para el análisis avanzado.

------------------------------------------------------------------------

# 17. Separación entre dato e inferencia

Ejemplo:

Hecho: "El contrato fue firmado el 1 de enero."

Inferencia IA: "Podría existir un problema de plazo."

Son entidades conceptualmente distintas.

------------------------------------------------------------------------

# 18. Estructura física sugerida para exports

``` text
CASE-2026-000001/
├── metadata/
├── parties/
├── claims/
├── facts/
├── evidence/
├── timeline/
├── documents/
│   ├── original/
│   ├── versions/
│   └── extracted/
├── legal/
├── jurisprudence/
├── arguments/
├── risks/
├── ai/
├── outcomes/
└── audit/
```

Esta estructura puede utilizarse para backups/exports, no necesariamente
como representación interna de PostgreSQL.

# V2 --- Modelo ampliado según los documentos antiguos

Añadir al expediente:

``` text
Witness
Expert
ProceduralEvent
Decision
OutcomeFactor
AnalysisCitation
```

## Completeness

El expediente debe registrar qué documentación existe.

Ejemplo:

``` text
Demand: YES
Answer: NO
Evidence: PARTIAL
Appeal: UNKNOWN
```

## Quality

Separar:

``` text
Completeness
Quality
Verification
```

## Provenance

Todo dato estructurado importante debe conservar:

``` text
sourceDocument
sourceVersion
page
paragraph
chunk
characterRange
```

## OutcomeFactor

Utilizarlo para describir factores observados, no causalidad.

## Decision

Distinguir una `Decision` concreta de un `CaseOutcome`.

Un caso puede tener:

``` text
Decision 1 → favorable
Decision 2 → appealed
Decision 3 → partially revoked
```

El `CaseOutcome` puede representar el resultado consolidado que
corresponda.

## Jerarquía y firmeza

Toda decisión debe conservar:

-   `courtHierarchyLevel`;
-   `finalityStatus`.

Esto debe utilizarse en análisis de similitud y patrones.

## Knowledge scopes

Cada elemento debe poder pertenecer a:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

## Golden dataset

Preparar:

``` text
isGoldenDataset
groundTruthVersion
reviewedBy
reviewedAt
```

Nunca modificar el ground truth automáticamente.

## Tipos de documento

Preparar desde el principio:

-   demanda;
-   contestación;
-   escritos;
-   contrato;
-   email;
-   informe;
-   pericial;
-   declaración;
-   fotografía;
-   vídeo;
-   audio;
-   transcripción;
-   acta;
-   sentencia;
-   auto;
-   recurso;
-   casación;
-   otros.

La estructura no obliga a implementar todos estos tipos en el primer
MVP.
