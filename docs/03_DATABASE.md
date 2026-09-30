# DATABASE.md --- Modelo de datos jurídico

## 1. Principio

El modelo actual del piloto contiene principalmente:

-   metadata de sentencias;
-   hechos;
-   argumentos;
-   PDF original.

Esto es un buen inicio para una base de conocimiento de jurisprudencia,
pero **no debe convertirse directamente en el modelo de expediente de
usuario**.

Hay que separar:

`JudicialDecision` = sentencia/fuente jurídica.

`Case` = expediente de un cliente.

------------------------------------------------------------------------

# 2. Entidades principales

## User

-   id
-   authUserId
-   email
-   displayName
-   status
-   createdAt
-   updatedAt

## Firm

-   id
-   name
-   taxId opcional
-   barAssociation opcional
-   contactEmail
-   status
-   createdAt
-   updatedAt

## FirmMember

-   id
-   firmId
-   userId
-   role
-   status
-   joinedAt
-   invitedBy

------------------------------------------------------------------------

# 3. Invitaciones

## Invitation

-   id
-   firmId
-   email
-   role
-   tokenHash
-   expiresAt
-   acceptedAt
-   invitedBy
-   createdAt

Nunca guardar el token de invitación en texto plano si puede evitarse.

------------------------------------------------------------------------

# 4. Case

Campos recomendados:

-   id
-   reference
-   title
-   description
-   legalAreaId
-   procedureTypeId
-   jurisdictionId
-   courtId
-   procedureNumber
-   status
-   stage
-   priority
-   clientId
-   responsibleLawyerId
-   ownerUserId
-   ownerFirmId
-   confidentialityLevel
-   createdAt
-   updatedAt
-   closedAt

------------------------------------------------------------------------

# 5. Client

No asumir que el cliente siempre es persona física.

Tipos:

-   PERSON
-   COMPANY
-   PUBLIC_ENTITY
-   OTHER

Campos:

-   id
-   type
-   legalName
-   identifiers cifrados cuando corresponda
-   contact data
-   createdAt

------------------------------------------------------------------------

# 6. Party

Una causa puede tener muchas partes.

## CaseParty

-   id
-   caseId
-   partyType
-   name
-   clientId opcional
-   representative
-   lawyer
-   position
-   notes

Tipos:

-   PLAINTIFF
-   DEFENDANT
-   APPELLANT
-   APPELLEE
-   INTERVENOR
-   OTHER

------------------------------------------------------------------------

# 7. Claims / pretensiones

Esta entidad es necesaria y no estaba en el piloto.

## CaseClaim

-   id
-   caseId
-   partyId
-   title
-   description
-   amount
-   legalBasis
-   status
-   outcome
-   importance

Resultados:

-   GRANTED
-   PARTIALLY_GRANTED
-   REJECTED
-   WITHDRAWN
-   PENDING
-   UNKNOWN

Esto permitirá analizar victorias parciales.

------------------------------------------------------------------------

# 8. Facts

El modelo actual de `facts.json` es útil, pero debe ampliarse.

## Fact

-   id
-   caseId
-   description
-   factType
-   status
-   importance
-   confidence
-   verificationStatus
-   assertedByPartyId
-   verifiedByUserId
-   verifiedAt
-   createdAt

Importante:

`confidence` significa confianza de extracción/identificación de IA.

NO significa probabilidad de que el hecho sea verdadero.

Estados:

-   ALLEGED
-   DISPUTED
-   PROVEN
-   NOT_PROVEN
-   UNKNOWN
-   WITHDRAWN

------------------------------------------------------------------------

# 9. FactSource

No almacenar solamente:

`document_id + page`

Crear:

## SourceReference

-   id
-   sourceType
-   documentId
-   legalSourceId
-   decisionId
-   page
-   paragraph
-   section
-   quoteHash
-   locator

Esto permitirá que una cita sea navegable.

------------------------------------------------------------------------

# 10. Timeline

## CaseEvent

-   id
-   caseId
-   eventDate
-   eventType
-   title
-   description
-   sourceReferenceId
-   importance
-   createdBy

Ejemplos:

-   contrato;
-   incumplimiento;
-   requerimiento;
-   demanda;
-   contestación;
-   audiencia;
-   sentencia;
-   recurso;
-   pago.

------------------------------------------------------------------------

# 11. Evidence

Esta entidad falta en el piloto y es fundamental.

## Evidence

-   id
-   caseId
-   type
-   title
-   description
-   status
-   relevance
-   authenticityStatus
-   submittedByPartyId
-   documentId
-   createdAt

Tipos:

-   DOCUMENTARY
-   TESTIMONIAL
-   EXPERT
-   DIGITAL
-   PHYSICAL
-   OTHER

------------------------------------------------------------------------

# 12. Arguments

El modelo actual de `arguments.json` es aprovechable.

Ampliar:

-   id
-   caseId
-   partyId
-   side
-   type
-   title
-   description
-   legalBasis
-   status
-   importance
-   aiConfidence
-   verificationStatus
-   reviewedBy
-   reviewedAt

Tipos:

-   PROCEDURAL
-   FACTUAL
-   LEGAL
-   EVIDENTIARY
-   CONTRACTUAL
-   CONSTITUTIONAL
-   OTHER

Estados del argumento:

-   ASSERTED
-   ACCEPTED
-   REJECTED
-   PARTIALLY_ACCEPTED
-   UNKNOWN

No confundir `status` del argumento con resultado del caso.

------------------------------------------------------------------------

# 13. Document

-   id
-   caseId nullable
-   firmId nullable
-   ownerUserId nullable
-   name
-   documentType
-   mimeType
-   size
-   sha256
-   storageKey
-   confidentiality
-   processingStatus
-   uploadedBy
-   createdAt

------------------------------------------------------------------------

# 14. DocumentVersion

-   id
-   documentId
-   version
-   storageKey
-   sha256
-   createdBy
-   createdAt
-   metadata

Nunca sobrescribir silenciosamente un documento.

------------------------------------------------------------------------

# 15. LegalSource

-   id
-   sourceType
-   title
-   officialReference
-   sourceUrl
-   jurisdiction
-   publicationDate
-   effectiveFrom
-   effectiveTo
-   version
-   contentHash

------------------------------------------------------------------------

# 16. LegalArticle

-   id
-   legalSourceId
-   articleNumber
-   title
-   content
-   effectiveFrom
-   effectiveTo
-   version

------------------------------------------------------------------------

# 17. JudicialDecision

El piloto actual debe migrar a esta entidad.

Campos:

-   id
-   source
-   sourceUrl
-   roj
-   ecli
-   idCendoj
-   court
-   courtLevel
-   seat
-   section
-   chamber
-   resolutionDate
-   rapporteur
-   procedureType
-   appealNumber
-   resolutionNumber
-   legalArea
-   branch
-   finalityStatus
-   retrievalDate
-   sourceHash

------------------------------------------------------------------------

# 18. JudicialDecisionSection

Una sentencia no debería ser un único texto.

Secciones:

-   encabezamiento;
-   antecedentes;
-   hechos;
-   fundamentos;
-   fallo;
-   votos particulares si existen.

Campos:

-   id
-   decisionId
-   sectionType
-   order
-   title
-   content

------------------------------------------------------------------------

# 19. JudicialDecisionArgument

Separar argumentos extraídos de una sentencia de argumentos de un caso
de usuario.

Campos:

-   id
-   decisionId
-   partyId opcional
-   side
-   type
-   description
-   legalBasis
-   outcome
-   sourceReference

------------------------------------------------------------------------

# 20. JudicialDecisionFact

Equivalente para hechos.

Esto permite aprender de sentencias sin contaminar los casos privados.

------------------------------------------------------------------------

# 21. KnowledgeChunk

-   id
-   sourceType
-   sourceId
-   firmId nullable
-   caseId nullable
-   documentId nullable
-   ownerUserId nullable
-   visibility
-   content
-   contentHash
-   chunkIndex
-   tokenCount
-   embeddingId
-   metadata

------------------------------------------------------------------------

# 22. AIAnalysis

-   id
-   caseId
-   createdBy
-   model
-   modelVersion
-   promptVersion
-   status
-   createdAt
-   completedAt

------------------------------------------------------------------------

# 23. AIAnalysisResult

-   id
-   analysisId
-   category
-   title
-   content
-   confidence
-   reviewed
-   reviewedBy
-   reviewedAt

Categorías:

-   SUMMARY
-   FAVORABLE
-   ADVERSE
-   PARTIAL
-   RISK
-   COUNTER_ARGUMENT
-   MISSING_INFORMATION
-   LEGAL_SOURCE
-   CASE_LAW
-   EVIDENCE

------------------------------------------------------------------------

# 24. CaseOutcome

Esta entidad es especialmente recomendable.

Debe guardar el resultado real de un procedimiento.

Campos:

-   id
-   caseId
-   decisionId opcional
-   outcomeType
-   date
-   summary
-   reviewedBy

Tipos:

-   WON
-   PARTIALLY_WON
-   LOST
-   SETTLED
-   DISMISSED
-   WITHDRAWN
-   PENDING
-   OTHER

Y además:

`ClaimOutcome`

para saber qué pretensión concreta fue estimada o rechazada.

Esto será esencial para análisis posteriores.

------------------------------------------------------------------------

# 25. Permission

-   id
-   subjectType
-   subjectId
-   resourceType
-   resourceId
-   permission
-   grantedBy
-   createdAt
-   expiresAt
-   revokedAt

Permisos:

-   VIEW
-   DOWNLOAD
-   EDIT
-   UPLOAD
-   ANALYZE
-   SHARE
-   EXPORT
-   DELETE

------------------------------------------------------------------------

# 26. AuditLog

-   id
-   actorUserId
-   firmId
-   action
-   resourceType
-   resourceId
-   metadata
-   createdAt

No almacenar documentos completos.

------------------------------------------------------------------------

# 27. Índices

Crear índices para:

-   caseId;
-   firmId;
-   ownerUserId;
-   procedureNumber;
-   ECLI;
-   ROJ;
-   CENDOJ;
-   resolutionDate;
-   legalArea;
-   court;
-   documentId;
-   permissions;
-   visibility.

------------------------------------------------------------------------

# 28. Regla de separación

No usar `case_id` para identificar simultáneamente:

-   una sentencia pública;
-   un expediente de cliente.

Actualmente el piloto utiliza `CASE-000001` para sentencias CENDOJ.

Migrar conceptualmente:

`CASE-000001` → `JD-000001`

si representa una resolución judicial.

Los expedientes de usuarios deben tener IDs de caso diferentes.

------------------------------------------------------------------------

# 29. Metadatos actuales del piloto

Los siguientes datos del piloto son útiles y deben conservarse:

-   source;
-   source_url;
-   Roj;
-   ECLI;
-   CENDOJ;
-   court;
-   section;
-   resolution_date;
-   rapporteur;
-   procedure_type;
-   appeal_number;
-   resolution_number;
-   branch;
-   finality_status;
-   retrieval_date;
-   sha256;
-   search_term_used.

`usage_context` debe pasar a una política de procedencia/licencia, no
formar parte del contenido jurídico.

# V2 --- Entidades adicionales obligatorias

Los documentos antiguos aportan varias entidades que deben incorporarse
al modelo final.

## Completeness / Quality

En `Case`:

-   completenessScore;
-   qualityScore;
-   verificationPercentage;
-   sourceQuality;
-   extractionQuality.

Estos indicadores deben explicar qué información existe.

Ejemplo:

``` text
Judgment: YES
Complaint: YES
Answer: NO
Evidence: PARTIAL
Appeal: UNKNOWN
```

`UNKNOWN` no significa `NO`.

## Witness

Añadir:

-   role;
-   topics;
-   credibilityAssessment;
-   verificationStatus;
-   sourceReferences.

## Expert

Añadir:

-   subject;
-   methodology;
-   conclusions;
-   judicialAssessment;
-   verificationStatus;
-   sourceReferences.

## ProceduralEvent

Entidad explícita para:

-   filing;
-   answer;
-   motion;
-   hearing;
-   judgment;
-   appeal;
-   cassation;
-   settlement.

## Decision

Además de `CaseOutcome`, mantener una entidad de decisión/resolución
con:

-   court;
-   courtHierarchyLevel;
-   decisionType;
-   result;
-   finalityStatus;
-   reasoning;
-   orders;
-   sourceReference.

Esto permite distinguir el resultado del caso de cada resolución
procesal.

## OutcomeFactor

Añadir:

-   category;
-   description;
-   side;
-   impact;
-   importance;
-   confidence;
-   verificationStatus;
-   sourceReferences.

Importante: un `OutcomeFactor` es un factor observado/asociado, no una
causalidad demostrada.

## AnalysisCitation

Conviene crear una entidad específica:

-   analysisId;
-   sourceReferenceId;
-   quoteOrExcerpt;
-   claimId opcional.

## SourceType

Normalizar:

``` text
PRIMARY_OFFICIAL
PUBLIC_DATABASE
COURT_DOCUMENT
LAWYER_PROVIDED
CLIENT_PROVIDED
USER_ENTERED
AI_GENERATED
OTHER
```

## VerificationStatus

Mantener:

``` text
VERIFIED
SOURCE_CONFIRMED
AI_EXTRACTED
AI_INFERRED
UNKNOWN
```

## Knowledge scopes

Añadir un concepto explícito de:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

No sustituye `Permission`; lo complementa.

## Golden dataset

Añadir:

-   isGoldenDataset;
-   groundTruthVersion;
-   reviewedBy;
-   reviewedAt.

La IA nunca sobrescribe el ground truth.

## Privileged information

Preparar una clasificación técnica más estricta para comunicaciones
abogado-cliente y notas de estrategia.

Estas piezas nunca deben entrar automáticamente en conocimiento global.
