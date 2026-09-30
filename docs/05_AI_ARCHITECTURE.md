# AI_ARCHITECTURE.md --- Arquitectura de IA jurídica

## 1. Objetivo

La IA debe funcionar como asistente de análisis jurídico con
trazabilidad, no como juez ni como sustituto del abogado.

La interfaz debe evitar presentar una conclusión como garantía de
resultado.

------------------------------------------------------------------------

# 2. Capas de conocimiento

El RAG puede combinar:

1.  legislación pública;
2.  jurisprudencia pública;
3.  conocimiento del despacho autorizado;
4.  documentos del caso autorizados;
5.  hechos y argumentos estructurados.

Nunca combinar sin filtros de autorización.

------------------------------------------------------------------------

# 3. Pipeline

Pregunta → identificar contexto → autorización → query expansion →
búsqueda keyword → búsqueda vectorial → filtros jurídicos → reranking →
contexto → LLM → structured output → validación → citas → revisión
humana.

------------------------------------------------------------------------

# 4. Búsqueda híbrida

Combinar:

-   BM25/full text;
-   embeddings;
-   metadata filtering;
-   reranking.

La búsqueda semántica sola no es suficiente para legislación y
jurisprudencia.

------------------------------------------------------------------------

# 5. Chunking

No cortar documentos únicamente cada N tokens.

Preferir segmentación semántica:

### Sentencias

-   antecedentes;
-   hechos;
-   fundamentos;
-   cada fundamento jurídico;
-   fallo.

### Legislación

-   artículo;
-   apartado;
-   disposición.

### Expedientes

-   sección;
-   párrafo;
-   tabla;
-   página.

Mantener `sourceReference`.

------------------------------------------------------------------------

# 6. Citas

Toda afirmación importante debe poder enlazar a:

-   documento;
-   página;
-   párrafo;
-   artículo;
-   sentencia;
-   sección.

Ejemplo:

`[Documento X, pág. 14]`

Al hacer click debe abrir el documento en el punto correspondiente
cuando sea posible.

------------------------------------------------------------------------

# 7. Tipos de información

Distinguir:

FACT LEGAL_RULE EVIDENCE ARGUMENT COUNTER_ARGUMENT JUDICIAL_DECISION
USER_NOTE AI_INFERENCE

Nunca presentar `AI_INFERENCE` como hecho.

------------------------------------------------------------------------

# 8. Análisis jurídico

El análisis debe generar:

## Resumen

Qué ocurre en el expediente.

## Argumentos favorables

Qué elementos pueden apoyar una posición.

## Argumentos desfavorables

Qué elementos pueden perjudicarla.

## Parcial

Qué pretensiones o extremos tienen soporte diferente.

## Riesgos

Qué podría hacer fracasar un argumento.

## Contraargumentos

Qué podría defender la otra parte.

## Evidencia

Qué documentos apoyan cada punto.

## Legislación

Artículos relevantes.

## Jurisprudencia

Resoluciones comparables.

## Información faltante

Qué información adicional podría modificar el análisis.

------------------------------------------------------------------------

# 9. Resultado por pretensión

No analizar únicamente:

"¿Quién gana?"

Analizar:

`Claim 1 → outcome`

`Claim 2 → outcome`

`Claim 3 → outcome`

Esto permite explicar:

-   victoria total;
-   victoria parcial;
-   derrota;
-   puntos pendientes.

------------------------------------------------------------------------

# 10. Comparación con jurisprudencia

Para cada sentencia similar:

-   similitud de hechos;
-   similitud jurídica;
-   diferencias;
-   argumentos usados;
-   resultado;
-   aplicabilidad;
-   limitaciones.

La similitud semántica no significa que el resultado jurídico sea
aplicable.

------------------------------------------------------------------------

# 11. Structured output

Ejemplo conceptual:

``` json
{
  "summary": {},
  "favorableArguments": [],
  "adverseArguments": [],
  "partialScenarios": [],
  "risks": [],
  "counterArguments": [],
  "legalSources": [],
  "caseLaw": [],
  "evidence": [],
  "missingInformation": []
}
```

Validar con Zod.

------------------------------------------------------------------------

# 12. Confianza

Separar:

`extractionConfidence`

de:

`legalAssessmentConfidence`

y de:

`factVerificationStatus`.

Nunca interpretar una confianza 0.95 de extracción como "95% de
posibilidades de ganar".

------------------------------------------------------------------------

# 13. Revisión humana

Estados:

-   UNREVIEWED
-   REVIEWED
-   MODIFIED
-   REJECTED

El abogado puede modificar una conclusión.

Guardar ambas versiones:

-   AI original;
-   revisión humana.

------------------------------------------------------------------------

# 14. Análisis incremental

Cuando se añada información:

-   recalcular documentos relevantes;
-   marcar análisis potencialmente obsoleto;
-   ofrecer `Reanalizar`.

Un análisis antiguo debe indicar qué versión del expediente utilizó.

------------------------------------------------------------------------

# 15. Prompt injection

Los documentos son contenido no confiable.

Separar estrictamente:

SYSTEM DEVELOPER USER RETRIEVED_DATA

El contenido recuperado no puede modificar:

-   permisos;
-   herramientas;
-   system prompt;
-   acceso a documentos.

------------------------------------------------------------------------

# 16. Anti-alucinación

Si no existe fuente suficiente:

`No se ha encontrado una fuente suficiente para respaldar esta afirmación.`

No inventar:

-   artículos;
-   sentencias;
-   ECLI;
-   Roj;
-   hechos;
-   números de procedimiento.

------------------------------------------------------------------------

# 17. Modelo de proveedor

Crear:

``` text
AIProvider
```

Implementaciones:

``` text
ClaudeProvider
OpenAIProvider
MockAIProvider
```

La lógica jurídica debe estar desacoplada del proveedor.

------------------------------------------------------------------------

# 18. Auditoría AI

Guardar:

-   modelo;
-   versión;
-   promptVersion;
-   timestamp;
-   documentos utilizados;
-   chunks;
-   fuentes;
-   usuario;
-   resultado.

No guardar innecesariamente contenido sensible en sistemas externos.

------------------------------------------------------------------------

# 19. Explicabilidad

Cada bloque importante de una respuesta debe poder responder:

"¿De dónde sale esto?"

La interfaz debe permitir abrir la fuente.

------------------------------------------------------------------------

# 20. Dataset futuro

Los casos históricos pueden utilizarse para análisis posteriores si
existe base jurídica, política de uso y tratamiento adecuados.

No asumir que:

"más casos = mejor modelo".

Antes de crear modelos predictivos debe existir:

-   dataset normalizado;
-   outcomes fiables;
-   metodología;
-   evaluación;
-   control de sesgos;
-   separación train/test;
-   revisión jurídica.

La primera versión debe utilizar RAG y análisis asistido, no predicción
automática del resultado judicial.

# V2 --- Mejoras de IA procedentes de la documentación antigua

## 1. Modos de conocimiento

El chat debe tener modos explícitos:

``` text
CASE_ONLY
PUBLIC_KNOWLEDGE
ORGANIZATION_KNOWLEDGE
```

Nunca mezclar automáticamente.

## 2. Hybrid search

La búsqueda debe combinar:

``` text
semantic/vector
+
keyword/full-text
+
structured filters
```

Ejemplos:

-   jurisdicción;
-   procedimiento;
-   tribunal;
-   fecha;
-   materia;
-   instancia.

## 3. Similar cases

La similitud debe considerar:

-   factual similarity;
-   legal similarity;
-   procedural similarity;
-   evidence similarity;
-   semantic similarity;
-   jurisdiction;
-   procedure;
-   court;
-   time;
-   hierarchy;
-   finality.

La UI debe explicar por qué dos casos son similares.

No mostrar únicamente un porcentaje.

## 4. Outcome factors

El sistema puede decir:

> "Este factor aparece asociado a determinados resultados en los casos
> analizados."

No:

> "Este factor causa que se gane."

## 5. Counterargument engine

El motor debe:

1.  identificar argumentos propios;
2.  identificar argumentos contrarios;
3.  localizar casos similares;
4.  localizar pruebas relevantes de la contraparte;
5.  detectar vulnerabilidades;
6.  generar preguntas de revisión.

## 6. Gap analysis

Comparar el expediente actual con:

-   estructura esperada;
-   documentos disponibles;
-   casos comparables;
-   requisitos jurídicos cuando exista fuente suficiente.

Debe distinguir:

`NO ENCONTRADO`

de:

`NO EXISTE`.

## 7. Provenance por afirmación

Una respuesta estructurada puede adoptar:

``` json
{
  "answer": "...",
  "claims": [
    {
      "text": "...",
      "type": "SOURCE_CONFIRMED",
      "citations": [
        {
          "sourceReferenceId": "...",
          "page": 43,
          "chunkId": "..."
        }
      ]
    }
  ]
}
```

## 8. Evaluación

Crear benchmarks para:

-   fact extraction;
-   argument extraction;
-   evidence extraction;
-   outcome classification;
-   citation accuracy;
-   retrieval precision;
-   retrieval recall;
-   hallucination rate;
-   authorization;
-   prompt injection.

## 9. Golden dataset

El golden dataset sirve para evaluar y mejorar prompts/RAG.

No debe utilizarse para justificar predicciones de resultados con pocos
ejemplos.

## 10. Responsabilidad

Cada `AIAnalysis` debe conservar:

-   modelo;
-   versión del modelo;
-   promptVersion;
-   timestamp;
-   fuentes;
-   chunks utilizados;
-   usuario;
-   estado de revisión.

La UI debe mostrar si el resultado está:

-   UNREVIEWED;
-   REVIEWED;
-   MODIFIED;
-   REJECTED.
