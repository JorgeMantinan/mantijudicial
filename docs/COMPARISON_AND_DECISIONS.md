# COMPARISON_AND_DECISIONS.md

## Veredicto

Los tres documentos antiguos NO son peores. De hecho, contienen varias
especificaciones que mejoran claramente la documentación nueva.

La mejor solución es:

``` text
DOCUMENTACIÓN NUEVA
        +
AI_BUILD_SPEC.md
        +
DATASET_SPEC.md
        +
FOUNDER_MANUAL.md
        ↓
DOCUMENTACIÓN V2
```

No recomiendo sustituir la documentación nueva por los antiguos ni
copiarlos enteros sin filtrar.

------------------------------------------------------------------------

# 1. AI_BUILD_SPEC.md

Es el documento antiguo más importante para la arquitectura.

Aporta:

-   multi-tenancy;
-   scopes de conocimiento;
-   provenance;
-   UNKNOWN;
-   verificationStatus;
-   hybrid search;
-   similar cases;
-   comparison;
-   counterargument engine;
-   gap analysis;
-   modos del chat;
-   evaluation;
-   golden dataset;
-   prompt injection;
-   auditoría;
-   demo mode;
-   acceptance criteria.

## Decisión

**Integrarlo casi completamente.**

Especialmente importantes:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

y:

``` text
CASE_ONLY
PUBLIC_KNOWLEDGE
ORGANIZATION_KNOWLEDGE
```

------------------------------------------------------------------------

# 2. DATASET_SPEC.md

Es especialmente valioso para la parte de datos.

Aporta:

-   completeness;
-   quality;
-   verification;
-   document types;
-   provenance;
-   source types;
-   golden dataset;
-   test set;
-   anonimización;
-   outcome factors;
-   firmeza;
-   jerarquía judicial.

## Decisión

**Integrarlo en Database, Case Data Model y AI Architecture.**

Una mejora especialmente importante:

``` text
COMPLETENESS != QUALITY != VERIFICATION
```

------------------------------------------------------------------------

# 3. FOUNDER_MANUAL.md

No es una especificación de código. Es un manual operativo.

Aporta:

-   estrategia de dataset;
-   validación humana;
-   fuentes;
-   gestión de derechos;
-   piloto;
-   golden dataset;
-   checklist de privacidad;
-   onboarding de despachos;
-   demo;
-   entrevistas con abogados;
-   responsabilidad profesional.

## Decisión

**No mezclarlo completamente con la documentación técnica.**

Debe mantenerse como documento operativo separado.

Lo que sí debe pasar a la arquitectura:

-   privacy;
-   provenance;
-   source licensing;
-   golden dataset;
-   human review;
-   export/delete;
-   security checklist.

------------------------------------------------------------------------

# 4. Diferencia fundamental

La documentación nueva estaba más orientada a:

``` text
CONSTRUIR LA APLICACIÓN
```

Los documentos antiguos estaban más orientados a:

``` text
CONSTRUIR + VALIDAR + OPERAR + CREAR DATASET
```

Por eso juntos son mejores.

------------------------------------------------------------------------

# 5. Cambio de modelo de datos

La documentación anterior ya proponía:

``` text
Case
Party
Claim
Fact
Argument
Evidence
```

Los documentos antiguos añaden:

``` text
Witness
Expert
ProceduralEvent
Decision
OutcomeFactor
AnalysisCitation
```

Se incorporan todos en V2.

------------------------------------------------------------------------

# 6. Cambio importante: Decision vs Outcome

No guardar simplemente:

``` text
case.outcome = FAVORABLE
```

Una causa puede tener:

``` text
sentencia inicial
↓
recurso
↓
casación
↓
resultado final
```

Por eso:

``` text
Decision
```

y:

``` text
CaseOutcome
```

son conceptos diferentes.

------------------------------------------------------------------------

# 7. Cambio importante: firmeza

Incorporar:

``` text
FIRM
APPEALED_PENDING
REVOKED_ON_APPEAL
PARTIALLY_REVOKED
UNKNOWN
```

Una resolución recurrida no debe alimentar estadísticas como si fuera el
resultado final.

------------------------------------------------------------------------

# 8. Cambio importante: jerarquía

Incorporar:

``` text
SUPREME_COURT_UNIFIED_DOCTRINE
SUPREME_COURT
HIGH_COURT_OF_JUSTICE
PROVINCIAL_COURT
FIRST_INSTANCE
OTHER
UNKNOWN
```

No para afirmar automáticamente que una fuente "vale X", sino para que
el sistema pueda distinguir el peso y contexto institucional de las
resoluciones.

------------------------------------------------------------------------

# 9. Cambio importante: outcome factors

Los documentos antiguos tienen razón en introducirlos, pero con una
regla:

``` text
factor observado
≠
causa demostrada
```

La IA debe usar lenguaje como:

> "Aparece asociado en los casos analizados."

y no:

> "Esto provoca que se gane."

------------------------------------------------------------------------

# 10. Cambio importante: completeness

Añadirlo desde el principio.

Un expediente puede tener:

``` text
Completeness 55%
Quality 95%
Verification 100%
```

Eso significa:

"Hay poca documentación disponible, pero la que tenemos está bien
verificada."

------------------------------------------------------------------------

# 11. Cambio importante: modos de IA

La propuesta nueva hablaba de conocimiento público/privado, pero la
documentación antigua lo concreta mejor:

``` text
CASE_ONLY
PUBLIC_KNOWLEDGE
ORGANIZATION_KNOWLEDGE
```

Esto debería formar parte visible de la interfaz.

------------------------------------------------------------------------

# 12. Cambio importante: casos similares

No utilizar solamente embeddings.

El motor debe poder considerar:

``` text
hechos
normativa
procedimiento
pruebas
tribunal
fecha
jurisdicción
jerarquía
firmeza
```

Y explicar por qué un caso es similar.

------------------------------------------------------------------------

# 13. Cambio importante: proveedor

La documentación nueva ya proponía AIProvider.

Los antiguos lo amplían a:

``` text
AIProvider
EmbeddingProvider
OCRProvider
```

Debe incorporarse.

------------------------------------------------------------------------

# 14. Lo que NO copiaría literalmente

No copiaría directamente:

-   roles `SUPER_ADMIN` si no son necesarios en el producto inicial;
-   `PARALEGAL`/`VIEWER` como UX obligatoria;
-   scores de "probabilidad de ganar";
-   cualquier lógica que convierta correlaciones en causalidad;
-   afirmaciones legales concretas del Founder Manual sin verificar su
    vigencia;
-   una cifra fija de licencias o límites de reutilización de fuentes
    sin comprobar la normativa/condiciones actuales.

El Founder Manual contiene afirmaciones operativas sobre CENDOJ/CGPJ que
deben tratarse como información a verificar antes de usarlas para una
decisión comercial o de adquisición de datos.

------------------------------------------------------------------------

# 15. Qué mantendría de la documentación nueva

La nueva documentación es mejor en:

-   separación de `Case` y `JudicialDecision`;
-   permisos abogado ↔ despacho;
-   estructura de Storage;
-   arquitectura de seguridad;
-   migración desde gestoría;
-   UX;
-   orden de implementación;
-   modelo de propiedad;
-   revocación;
-   signed URLs;
-   separación de billing.

------------------------------------------------------------------------

# 16. Arquitectura final recomendada

``` text
                    ┌──────────────────┐
                    │ GLOBAL KNOWLEDGE │
                    │ BOE / CENDOJ /   │
                    │ jurisprudencia   │
                    └────────┬─────────┘
                             │
                             ▼
USER → FIRM → PERMISSIONS → AUTHORIZED KNOWLEDGE
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        PRIVATE CASES         FIRM KNOWLEDGE
              │                     │
              └──────────┬──────────┘
                         ▼
                  HYBRID RETRIEVAL
                         │
                    RERANKING
                         │
                         ▼
                    AI ANALYSIS
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           SOURCES    RISKS      ARGUMENTS
              │
              ▼
        HUMAN REVIEW
```

------------------------------------------------------------------------

# 17. Conclusión

Los documentos antiguos son **complementarios y, en varios puntos,
mejores que la primera versión que preparé**.

No empezaría de cero.

La V2 que acompaña este paquete incorpora sus partes útiles dentro de
los documentos nuevos.

El resultado es una especificación bastante más completa para entregar a
OpenCode.
