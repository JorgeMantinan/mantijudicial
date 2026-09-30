# Plataforma jurídica --- Plan de implementación

## 1. Regla de desarrollo

No construir todo a la vez.

Orden obligatorio:

1.  arquitectura;
2.  identidad;
3.  autorización;
4.  casos;
5.  documentos;
6.  OCR/indexación;
7.  conocimiento jurídico;
8.  búsqueda;
9.  IA;
10. análisis avanzado;
11. billing;
12. optimización.

La seguridad y el aislamiento tienen prioridad sobre la velocidad.

------------------------------------------------------------------------

## 2. Fase 0 --- Preparación

-   Crear nuevo repositorio a partir del core.
-   Mantener Turborepo + pnpm.
-   Eliminar dominio de gestoría.
-   Revisar variables de entorno.
-   Revisar middleware.
-   Revisar Auth.
-   Revisar Prisma.
-   Revisar RLS.
-   Revisar Storage.
-   Revisar sistema de perfiles.
-   Crear documentación de arquitectura.

No copiar modelos fiscales.

------------------------------------------------------------------------

## 3. Fase 1 --- Identidad

Entidades:

-   User
-   Firm
-   FirmMember
-   Invitation

Roles:

-   LAWYER
-   FIRM_ADMIN
-   FIRM_MEMBER
-   PLATFORM_ADMIN

Preparar MFA aunque inicialmente pueda ser opcional.

------------------------------------------------------------------------

## 4. Fase 2 --- Autorización

Crear:

`AuthorizationService`

Operaciones:

-   canViewResource()
-   canEditResource()
-   canDownloadResource()
-   canShareResource()
-   canAnalyzeResource()
-   canDeleteResource()

El frontend nunca es una frontera de seguridad.

Toda operación sensible debe comprobarse server-side.

------------------------------------------------------------------------

## 5. Fase 3 --- Casos

CRUD:

-   crear;
-   editar;
-   archivar;
-   restaurar;
-   eliminar lógicamente;
-   compartir;
-   cambiar responsable.

Rutas:

-   `/dashboard`
-   `/cases`
-   `/cases/new`
-   `/cases/[id]`
-   `/cases/[id]/edit`

------------------------------------------------------------------------

## 6. Fase 4 --- Documentos

Tipos iniciales:

-   PDF
-   DOCX
-   TXT
-   JPG
-   PNG

Estados:

-   UPLOADING
-   PROCESSING
-   OCR
-   INDEXING
-   READY
-   FAILED

Pipeline:

Upload → validación → malware scan → hash → Storage → OCR/extracción →
normalización → chunking → indexación → READY

Conservar siempre el original.

------------------------------------------------------------------------

## 7. Fase 5 --- Knowledge Base

Entidades:

-   KnowledgeDocument
-   KnowledgeChunk
-   KnowledgeEmbedding
-   KnowledgeSource

Cada chunk debe conservar:

-   firmId;
-   caseId;
-   documentId;
-   ownerUserId;
-   visibility;
-   sourceType;
-   sourceReference.

------------------------------------------------------------------------

## 8. Fase 6 --- Legislación

No almacenar legislación en código.

Pipeline:

fuente oficial → importador → parser → versión → artículos → relaciones
→ embeddings → índice.

Debe poder responder:

-   texto vigente;
-   texto en una fecha determinada;
-   fuente oficial;
-   versión utilizada por IA.

------------------------------------------------------------------------

## 9. Fase 7 --- Jurisprudencia

Crear módulo `JudicialDecision`.

No tratar una sentencia simplemente como PDF.

Extraer:

-   tribunal;
-   sala;
-   sección;
-   fecha;
-   Roj;
-   ECLI;
-   CENDOJ;
-   procedimiento;
-   hechos;
-   fundamentos;
-   fallo;
-   legislación citada;
-   jurisprudencia citada;
-   relaciones.

------------------------------------------------------------------------

## 10. Fase 8 --- Búsqueda

Implementar:

1.  exacta;
2.  full-text;
3.  filtros;
4.  semántica;
5.  híbrida;
6.  reranking.

La búsqueda debe respetar permisos antes de devolver resultados.

------------------------------------------------------------------------

## 11. Fase 9 --- IA

Crear abstracción:

`AIProvider`

Implementaciones:

-   ClaudeProvider;
-   OpenAIProvider opcional;
-   MockAIProvider.

No acoplar el dominio entero a un único proveedor.

------------------------------------------------------------------------

## 12. Fase 10 --- análisis jurídico

Pipeline:

pregunta → identificar caso → comprobar permisos → recuperar hechos
autorizados → recuperar documentos autorizados → recuperar legislación →
recuperar jurisprudencia → reranking → contexto → LLM → validación →
citas → resultado.

Los documentos recuperados son datos, no instrucciones.

------------------------------------------------------------------------

## 13. Fase 11 --- análisis incremental

Cuando se añada:

-   documento;
-   prueba;
-   hecho;
-   sentencia;
-   legislación;

el sistema debe poder marcar:

`NUEVA INFORMACIÓN POTENCIALMENTE RELEVANTE`

y permitir:

`REANALIZAR CASO`

No ejecutar análisis completo automáticamente por defecto.

------------------------------------------------------------------------

## 14. Fase 12 --- billing

Si se reutiliza Stripe:

-   planes;
-   suscripciones;
-   límites de IA;
-   almacenamiento;
-   número de abogados;
-   número de casos;
-   créditos de análisis.

El billing debe estar separado del dominio jurídico.

------------------------------------------------------------------------

## 15. Tests

Unit:

-   autorización;
-   permisos;
-   parsing;
-   chunking;
-   validación AI;
-   versionado legal.

Integration:

-   RLS;
-   Storage;
-   compartir;
-   revocar;
-   retrieval.

E2E:

-   abogado crea caso;
-   sube documento;
-   otro abogado no lo ve;
-   despacho no lo ve sin permiso;
-   se comparte;
-   se revoca;
-   IA deja de recuperar el documento.

------------------------------------------------------------------------

## 16. Test de aislamiento obligatorio

Crear:

FIRM_A FIRM_B

LAWYER_A LAWYER_B

DOC_A DOC_B

LAWYER_A debe fallar al:

-   leer DOC_B;
-   descargar DOC_B;
-   buscar DOC_B;
-   obtener su signed URL;
-   recuperar DOC_B mediante IA.

Este test debe permanecer permanentemente.

------------------------------------------------------------------------

## 17. Prompt injection

Un documento puede contener instrucciones maliciosas.

Separar:

SYSTEM DEVELOPER USER RETRIEVED_DOCUMENT

Los documentos recuperados nunca reciben privilegios de instrucciones.

------------------------------------------------------------------------

## 18. No implementar todavía

-   marketplace;
-   red social;
-   chat entre despachos;
-   automatización de presentación judicial;
-   predicción automática de sentencias;
-   decisión automática;
-   integraciones judiciales masivas.

Primero:

Casos + Documentos + Permisos + Fuentes jurídicas + RAG + Auditoría.

# V2 --- Cambios de planificación

La documentación antigua añade funcionalidades que deben entrar en el
roadmap, aunque no todas deben entrar en el primer sprint.

## Fase 0 adicional --- Dataset y evaluación

Antes de intentar sacar conclusiones sofisticadas:

-   definir esquema de dataset;
-   definir `golden dataset`;
-   separar development/validation/test;
-   definir métricas;
-   crear casos de prueba;
-   definir provenance.

## Fase 1 --- Identidad y multi-tenancy

Añadir:

-   organización;
-   membresía;
-   múltiples organizaciones por usuario;
-   roles;
-   scopes de conocimiento.

Preparar roles adicionales como `PARALEGAL` y `VIEWER`, aunque
inicialmente la UX principal pueda centrarse en `LAWYER` y `FIRM_ADMIN`.

## Fase 2 --- Casos

Añadir desde el principio:

-   completeness;
-   quality;
-   verification;
-   sourceType;
-   privacyClassification.

## Fase 3 --- Document pipeline

Añadir explícitamente:

``` text
malware/security check
→ original
→ hash
→ extraction
→ OCR
→ classification
→ chunking
→ embeddings
→ structured extraction
→ human review
→ indexing
```

Cada etapa necesita:

-   status;
-   error;
-   retry;
-   timestamps.

## Fase 4 --- Knowledge graph jurídico

Añadir relaciones entre:

-   hechos;
-   pruebas;
-   argumentos;
-   normas;
-   precedentes;
-   decisiones;
-   resultados.

## Fase 5 --- Retrieval

Implementar:

-   hybrid search;
-   structured filters;
-   reranking;
-   similar cases;
-   explanation of similarity.

## Fase 6 --- IA

Añadir:

-   CASE_ONLY;
-   PUBLIC_KNOWLEDGE;
-   ORGANIZATION_KNOWLEDGE.

El modo debe estar visible.

## Fase 7 --- Advanced analysis

Añadir:

-   comparison;
-   counterargument engine;
-   gap analysis;
-   outcome factors.

## Fase 8 --- Evaluation

Antes de considerar fiable una funcionalidad:

-   citation accuracy;
-   retrieval precision/recall;
-   fact extraction;
-   argument extraction;
-   evidence extraction;
-   outcome classification;
-   hallucination rate;
-   authorization;
-   prompt injection.

## Cambio importante

`30-50 casos` puede ser un golden dataset inicial para prototipado, pero
no debe tratarse como suficiente para afirmar que el sistema puede
predecir resultados judiciales.
