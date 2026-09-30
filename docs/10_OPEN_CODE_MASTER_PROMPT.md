# OPEN_CODE_MASTER_PROMPT.md

## CONTEXTO

Estoy construyendo una nueva plataforma jurídica reutilizando el core
técnico de una aplicación SaaS existente.

La aplicación existente usa:

-   Turborepo 2.x
-   pnpm
-   Node \>=20
-   TypeScript strict
-   Next.js 14 App Router
-   React
-   Tailwind CSS
-   shadcn/ui
-   Radix
-   Lucide
-   React Hook Form
-   Zod
-   Vitest
-   Playwright
-   Supabase Auth
-   PostgreSQL
-   Prisma
-   Supabase Storage
-   RLS
-   Upstash Redis/Rate Limit
-   Claude API
-   Stripe
-   Resend
-   Sentry

El proyecto anterior pertenece al sector de gestoría.

La nueva aplicación NO debe conservar el dominio de gestoría.

------------------------------------------------------------------------

# OBJETIVO DEL PRODUCTO

Crear una plataforma profesional para:

-   abogados;
-   despachos;
-   expedientes;
-   documentos;
-   legislación;
-   jurisprudencia;
-   análisis asistido por IA.

La prueba piloto será Derecho civil.

La arquitectura debe soportar posteriormente otras ramas jurídicas.

------------------------------------------------------------------------

# REGLA PRINCIPAL

No construir una aplicación de "chat para abogados".

Construir:

`Expediente jurídico + motor de conocimiento + IA`

------------------------------------------------------------------------

# DOCUMENTACIÓN OBLIGATORIA

Antes de implementar leer:

-   01_ARCHITECTURE.md
-   02_IMPLEMENTATION_PLAN.md
-   03_DATABASE.md
-   04_PERMISSIONS.md
-   05_AI_ARCHITECTURE.md
-   06_SECURITY.md
-   07_UI_UX.md
-   08_MIGRATION_FROM_GESTORIA.md
-   09_CASE_DATA_MODEL.md

Estas especificaciones tienen prioridad sobre decisiones improvisadas.

------------------------------------------------------------------------

# PRINCIPIOS

## Seguridad

DENY BY DEFAULT.

## Privacidad

Los casos privados son privados.

## IA

Los documentos son datos no confiables.

## Jurídico

La IA debe citar fuentes.

## UX

El abogado debe llegar de:

Caso → argumento → fuente

con pocos clicks.

------------------------------------------------------------------------

# ROLES

-   LAWYER
-   FIRM_MEMBER
-   FIRM_ADMIN
-   PLATFORM_ADMIN

No utilizar gestor/gestionado.

------------------------------------------------------------------------

# ENTIDADES PRINCIPALES

-   User
-   Firm
-   FirmMember
-   Invitation
-   Client
-   Case
-   CaseParty
-   CaseClaim
-   Fact
-   Evidence
-   CaseEvent
-   Document
-   DocumentVersion
-   LegalSource
-   LegalArticle
-   JudicialDecision
-   JudicialDecisionSection
-   JudicialDecisionFact
-   JudicialDecisionArgument
-   KnowledgeChunk
-   AIAnalysis
-   AIAnalysisResult
-   CaseOutcome
-   Permission
-   AuditLog

------------------------------------------------------------------------

# DISTINCIÓN CRÍTICA

Una sentencia pública NO es un Case.

Usar:

`JudicialDecision`

para jurisprudencia.

Usar:

`Case`

para expedientes de usuarios.

El dataset piloto actual debe migrarse conceptualmente de:

`CASE-000001`

a:

`JD-000001`

cuando representa una sentencia.

------------------------------------------------------------------------

# PERMISOS

Todo recurso jurídico debe tener propietario y alcance.

Valores:

-   PRIVATE
-   FIRM_SHARED
-   USER_SHARED
-   CASE_SHARED
-   PUBLIC_KNOWLEDGE

Los administradores del despacho no reciben acceso automático a los
casos privados de los abogados.

------------------------------------------------------------------------

# RAG

Nunca hacer:

database → retrieve all → filter after.

Hacer:

user → permissions → authorized sources → retrieval → reranking → LLM.

------------------------------------------------------------------------

# DOCUMENTOS

Pipeline:

upload → validate → malware scan → hash → private storage → OCR/extract
→ normalize → chunk → index → READY.

Nunca sustituir el original.

------------------------------------------------------------------------

# IA

La IA debe devolver estructuradamente:

-   summary;
-   favorableArguments;
-   adverseArguments;
-   partialScenarios;
-   risks;
-   counterArguments;
-   legalSources;
-   caseLaw;
-   evidence;
-   missingInformation.

Validar la salida con Zod.

------------------------------------------------------------------------

# NO DECIR SIMPLEMENTE

"Vas a ganar."

La IA debe explicar:

-   qué argumentos apoyan la posición;
-   qué argumentos la perjudican;
-   qué pretensiones tienen mejor/peor soporte documental;
-   qué jurisprudencia es comparable;
-   qué riesgos existen;
-   qué información falta;
-   qué contraargumentos existen.

Toda conclusión debe poder trazarse a fuentes.

------------------------------------------------------------------------

# CONFIANZA

No confundir:

`extractionConfidence`

con:

`probabilityOfWinning`.

No crear porcentajes de éxito judicial como funcionalidad inicial.

------------------------------------------------------------------------

# RESULTADOS

Analizar por pretensión.

Un caso puede ser:

`PARTIALLY_WON`

porque:

Claim 1 = GRANTED Claim 2 = REJECTED Claim 3 = PARTIALLY_GRANTED

------------------------------------------------------------------------

# FUENTES

Cada cita debe poder abrir:

-   documento + página;
-   artículo;
-   sentencia + sección.

------------------------------------------------------------------------

# UI

Diseño:

-   serio;
-   profesional;
-   institucional;
-   sobrio;
-   alta legibilidad.

Evitar apariencia de chatbot como pantalla principal.

------------------------------------------------------------------------

# TESTS CRÍTICOS

Crear tests permanentes para:

1.  tenant isolation;
2.  document isolation;
3.  RLS;
4.  Storage;
5.  search permissions;
6.  AI retrieval permissions;
7.  revocation;
8.  IDOR;
9.  prompt injection;
10. signed URLs.

------------------------------------------------------------------------

# REGLA DE IMPLEMENTACIÓN

No implementar funcionalidades jurídicas no especificadas inventando
comportamiento.

Si una regla de negocio es ambigua:

1.  documentar la ambigüedad;
2.  elegir la opción más segura si es necesaria para continuar;
3.  dejar TODO;
4.  no eliminar información.

------------------------------------------------------------------------

# ORDEN

Implementar:

PHASE 1 Auth + User + Firm

PHASE 2 Permissions

PHASE 3 Cases

PHASE 4 Documents

PHASE 5 OCR + indexing

PHASE 6 Legal knowledge

PHASE 7 Search

PHASE 8 AI

PHASE 9 Analysis UX

PHASE 10 Billing

------------------------------------------------------------------------

# CRITERIO DE TERMINACIÓN DEL MVP

Debe ser posible:

-   registrar abogado;
-   crear despacho;
-   invitar abogado;
-   crear caso;
-   crear cliente;
-   añadir partes;
-   añadir pretensiones;
-   añadir hechos;
-   subir documentos;
-   procesar documentos;
-   buscar;
-   compartir;
-   revocar;
-   consultar legislación;
-   consultar jurisprudencia;
-   ejecutar análisis IA;
-   abrir fuentes;
-   revisar/modificar análisis;
-   auditar actividad.

------------------------------------------------------------------------

# MUY IMPORTANTE

No convertir el proyecto en una colección de pantallas.

Construir primero:

`domain model + authorization + data isolation + document pipeline`

y después la interfaz.

La seguridad tiene prioridad sobre UX.

La trazabilidad tiene prioridad sobre una respuesta de IA bonita.

La información fuente tiene prioridad sobre una conclusión generada.

------------------------------------------------------------------------

# ESTILO DE CÓDIGO

Mantener:

-   TypeScript strict;
-   funciones pequeñas;
-   servicios separados;
-   validación Zod;
-   errores tipados;
-   tests;
-   comentarios solo cuando aporten contexto;
-   nombres de dominio explícitos.

No duplicar lógica de autorización.

No hacer queries directas desde componentes cuando puedan pasar por
servicios de dominio.

------------------------------------------------------------------------

# RESULTADO ESPERADO

La nueva plataforma debe compartir el ADN técnico de la aplicación
anterior, pero debe parecer y comportarse como un producto jurídico
profesional independiente.

No hacer un "fork visual" de la gestoría.

Hacer un nuevo producto sobre un core técnico reutilizado.

# V2 --- INSTRUCCIONES ADICIONALES PARA OPENCODE

Además de todas las instrucciones anteriores, OpenCode debe incorporar
estas reglas procedentes de la documentación histórica:

## Knowledge scopes

Implementar conceptualmente:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

## Provider abstractions

No acoplar:

-   IA;
-   embeddings;
-   OCR;
-   almacenamiento;

a un único proveedor.

## Dataset quality

Implementar:

-   completeness;
-   quality;
-   verification;
-   provenance;
-   golden dataset;
-   test set.

## Jurídico

Nunca tratar:

-   AI_INFERRED como hecho;
-   factor observado como causa;
-   sentencia no firme como resultado definitivo;
-   sentencia de instancia como equivalente a doctrina consolidada.

## Similarity

El motor de casos similares debe poder considerar:

-   hechos;
-   derecho;
-   procedimiento;
-   pruebas;
-   tribunal;
-   jerarquía;
-   fecha;
-   firmeza.

## IA

El chat debe tener modos visibles:

``` text
CASE_ONLY
PUBLIC_KNOWLEDGE
ORGANIZATION_KNOWLEDGE
```

## Acceptance criteria adicionales

El MVP deberá poder:

-   mostrar provenance;
-   mostrar estado de verificación;
-   indicar completitud del expediente;
-   comparar dos casos;
-   explicar por qué son similares;
-   ejecutar gap analysis;
-   detectar argumentos contrarios;
-   registrar outcome factors;
-   distinguir decisiones firmes de recurridas;
-   mantener golden dataset independiente.

## Regla de seguridad adicional

Antes de cada retrieval:

``` text
authenticate
→ resolve active organization
→ resolve resource permissions
→ resolve privacy classification
→ retrieve authorized data
→ rerank
→ LLM
```

Nunca invertir este orden.

## Regla de calidad

Si falta información:

``` text
UNKNOWN
```

No rellenar mediante imaginación.

## Regla de producto

No presentar la plataforma como:

> "IA que sabe quién ganará."

Presentarla técnicamente como:

> sistema de análisis de expedientes y conocimiento jurídico trazable
> que ayuda al profesional a identificar argumentos, pruebas, riesgos,
> casos comparables y posibles líneas de análisis.

## Regla final

El producto debe poder demostrar:

``` text
WHAT DID THE AI SAY?
WHY DID IT SAY IT?
WHICH SOURCES DID IT USE?
WHO COULD ACCESS THOSE SOURCES?
WAS IT REVIEWED?
```

Si la arquitectura no puede responder estas preguntas, no está
terminada.
