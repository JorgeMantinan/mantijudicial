# LEGAL CASE INTELLIGENCE
## DATASET SPECIFICATION
### Version 1.0

---

# 1. OBJETIVO

Este documento define la estructura del dataset jurídico.

El dataset debe permitir almacenar casos judiciales de forma estructurada para que puedan ser:

- consultados;
- comparados;
- buscados;
- analizados;
- utilizados en RAG;
- evaluados;
- revisados por abogados.

El dataset debe conservar siempre la relación entre:

```text
CASE
DOCUMENT
FACT
ARGUMENT
EVIDENCE
DECISION
OUTCOME
SOURCE
```

---

# 2. PRINCIPIO FUNDAMENTAL

No sustituir un expediente por un resumen.

El sistema debe conservar:

```text
ORIGINAL DOCUMENT
        ↓
EXTRACTED TEXT
        ↓
STRUCTURED DATA
        ↓
AI ANALYSIS
```

Cada nivel debe poder rastrearse hacia el anterior.

---

# 3. TIPOS DE CASOS

## PUBLIC

Caso obtenido de una fuente pública.

## DEMO

Caso utilizado específicamente para demostrar la aplicación.

## PRIVATE

Caso aportado por un despacho/cliente.

## ANONYMIZED

Copia anonimizada de un caso privado que haya sido autorizada para uso más amplio.

---

# 4. COMPLETITUD

Cada caso debe tener:

```text
completeness_score
```

de 0 a 100.

Pero también registrar qué información existe.

Ejemplo:

```text
Judgment: YES
Complaint: YES
Answer: NO
Evidence: PARTIAL
Appeal: UNKNOWN
```

Nunca interpretar:

```text
NO DOCUMENT
```

como:

```text
EVENT DID NOT OCCUR
```

---

# 5. QUALITY

Separar:

```text
COMPLETENESS
QUALITY
VERIFICATION
```

Un caso puede ser:

```text
Completeness: 60%
Quality: 95%
Verification: 100%
```

Esto significa que conocemos muy bien el 60% disponible, pero no tenemos el expediente completo.

---

# 6. CASE

Campos:

```text
case_id
organization_id

title
external_reference

country
jurisdiction

court
procedure_type
procedure_number

status

start_date
end_date

claim_amount
currency

outcome

summary

source_type
privacy_classification

completeness_score
quality_score

created_at
updated_at
```

---

# 7. PARTIES

Cada parte:

```text
party_id
case_id

anonymized_name
role
entity_type

represented_by

source
verification_status
```

Roles:

```text
CLAIMANT
DEFENDANT
PLAINTIFF
RESPONDENT
PROSECUTION
DEFENSE
APPELLANT
APPELLEE
OTHER
```

Para datos públicos no incorporar PII innecesaria.

---

# 8. FACTS

Cada hecho:

```text
fact_id
case_id

description
fact_type

status

importance
confidence

verification_status

sources
```

Status:

```text
PROVEN
ALLEGED
DISPUTED
REJECTED
UNKNOWN
```

---

# 9. CLAIMS

Cada pretensión:

```text
claim_id
case_id
party_id

description
amount
legal_basis

status
importance
confidence

verification_status

sources
```

---

# 10. ARGUMENTS

Cada argumento:

```text
argument_id
case_id
party_id

side

type
description
legal_basis

status
importance
confidence

verification_status

sources
```

Tipos:

```text
FACTUAL
LEGAL
PROCEDURAL
EVIDENTIARY
INTERPRETATIVE
OTHER
```

Estados:

```text
ACCEPTED
REJECTED
PARTIALLY_ACCEPTED
NOT_ADDRESSED
UNKNOWN
```

---

# 11. EVIDENCE

Cada prueba:

```text
evidence_id
case_id

type
description

submitted_by

supports_facts
supports_arguments
opposes_arguments

judicial_assessment

weight
confidence

verification_status

sources
```

Tipos:

```text
DOCUMENTARY
EXPERT
WITNESS
DIGITAL
PHOTO
VIDEO
AUDIO
PHYSICAL
ADMISSION
OTHER
```

---

# 12. WITNESSES

Campos:

```text
witness_id
case_id

anonymized_name

party
role

topics

credibility_assessment

confidence
verification_status

sources
```

---

# 13. EXPERTS

Campos:

```text
expert_id
case_id

type
party

subject

conclusions
methodology

judicial_assessment

confidence
verification_status

sources
```

---

# 14. LEGAL RULES

Campos:

```text
rule_id

citation
description

jurisdiction

date_valid_from
date_valid_to

source

verification_status
```

La vigencia debe verificarse respecto a la fecha relevante.

---

# 15. PRECEDENTS

Campos:

```text
precedent_id

court
court_hierarchy_level
case_reference
date

legal_issue
holding

used_by
treatment

source

verification_status
```

`court_hierarchy_level` usa el mismo enum que en DECISIONS (sección 17.2). Un precedente de instancia no es jurisprudencia vinculante; distinguirlo evita que el sistema presente una sentencia aislada como si fuera doctrina consolidada.

Treatment:

```text
FOLLOWED
DISTINGUISHED
REJECTED
NOT_ADDRESSED
UNKNOWN
```

---

# 16. PROCEDURAL EVENTS

Campos:

```text
event_id
case_id

date

event_type

description

party
document

source

verification_status
```

Tipos:

```text
FILING
ANSWER
MOTION
HEARING
JUDGMENT
APPEAL
CASSATION
SETTLEMENT
OTHER
```

---

# 17. DECISIONS

Campos:

```text
decision_id
case_id

court
court_hierarchy_level
date

decision_type

result

finality_status

reasoning
orders

source

verification_status
```

Resultados:

```text
FAVORABLE
UNFAVORABLE
PARTIAL
DISMISSED
SETTLED
UNKNOWN
```

## 17.1. FIRMEZA (finality_status) — CAMPO CRÍTICO

Una resolución de instancia puede ser recurrida y revocada. Presentar el resultado de una `Decision` sin indicar su firmeza es engañoso: si el sistema dice "en 80 casos similares el resultado fue favorable" y una parte relevante de esas sentencias fueron luego revocadas en apelación o casación, el dato es falso aunque cada campo individual sea correcto.

```text
FIRM
APPEALED_PENDING
REVOKED_ON_APPEAL
PARTIALLY_REVOKED
UNKNOWN
```

Regla: mientras `finality_status = UNKNOWN` o `APPEALED_PENDING`, el sistema NO debe presentar el resultado como definitivo en ningún análisis agregado (similar cases, outcome factors, estadísticas). Debe mostrarse con una advertencia visible.

## 17.2. JERARQUÍA NORMATIVA (court_hierarchy_level) — CAMPO CRÍTICO

No todas las `Decision` pesan igual. Una sentencia del Tribunal Supremo en unificación de doctrina no es equivalente a una sentencia aislada de un Juzgado de Primera Instancia.

```text
SUPREME_COURT_UNIFIED_DOCTRINE
SUPREME_COURT
HIGH_COURT_OF_JUSTICE (TSJ)
PROVINCIAL_COURT (AP)
FIRST_INSTANCE
OTHER
UNKNOWN
```

Este campo debe usarse para ponderar (no solo mostrar) cualquier análisis de patrones, similitud o "casos comparables": una sentencia de instancia y una de doctrina consolidada del TS no deben contar como evidencia del mismo peso.

---

# 18. OUTCOME FACTORS

Representa factores observados en relación con el resultado.

Campos:

```text
factor_id
case_id

category
description

side

impact
importance
confidence

verification_status

sources
```

Categorías:

```text
FACT
ARGUMENT
EVIDENCE
PROCEDURE
WITNESS
EXPERT
LEGAL_RULE
PRECEDENT
OTHER
```

Impact:

```text
POSITIVE
NEGATIVE
NEUTRAL
UNKNOWN
```

IMPORTANTE:

Los factores no deben interpretarse automáticamente como causas.

Utilizar lenguaje como:

> "Factor observado en casos con resultado favorable."

No:

> "Este factor causa que se gane el caso."

---

# 19. DOCUMENT TYPES

Tipos iniciales:

```text
COMPLAINT
ANSWER
MOTION
CONTRACT
EMAIL
REPORT
EXPERT_REPORT
WITNESS_STATEMENT

PHOTO
VIDEO
AUDIO
TRANSCRIPT

HEARING_RECORD

JUDGMENT
ORDER
APPEAL
CASSATION

OTHER
```

---

# 20. DOCUMENT METADATA

Cada documento:

```text
document_id
case_id
organization_id

filename
mime_type
size

document_type

source_type
source_url

sha256

privacy_classification

uploaded_by
uploaded_at

verification_status
verified_by
verified_at
```

---

# 21. DOCUMENT VERSION

Cada versión:

```text
version_id
document_id
version_number

storage_key
sha256

created_by
created_at

change_description
```

Nunca eliminar silenciosamente una versión anterior.

---

# 22. DOCUMENT CHUNK

Campos:

```text
chunk_id

document_version_id
case_id
organization_id

chunk_index

text

page_number
paragraph_number

char_start
char_end

embedding

privacy_classification
```

---

# 23. PROVENANCE

Cada dato estructurado importante debe poder contener:

```text
source_document_id
source_version_id
page
paragraph
chunk_id
char_start
char_end
```

Esto permite responder:

> "¿De dónde sale esta información?"

---

# 24. SOURCE TYPES

```text
PRIMARY_OFFICIAL
PUBLIC_DATABASE
COURT_DOCUMENT
LAWYER_PROVIDED
CLIENT_PROVIDED
USER_ENTERED
AI_GENERATED
OTHER
```

---

# 25. VERIFICATION STATUS

```text
VERIFIED
SOURCE_CONFIRMED
AI_EXTRACTED
AI_INFERRED
UNKNOWN
```

---

# 26. PRIVACY

```text
PUBLIC
CLIENT_CONFIDENTIAL
FIRM_CONFIDENTIAL
LAWYER_ONLY
RESTRICTED
```

---

# 27. GOLDEN DATASET

Un caso puede marcarse:

```text
is_golden_dataset = true
```

si ha sido revisado manualmente.

Debe tener ground truth de:

```text
facts
claims
arguments
evidence
decision
outcome
outcome_factors
citations
```

---

# 28. GOLDEN DATASET — REGLAS

El ground truth debe ser:

- revisado por humano;
- documentado;
- versionado;
- independiente del output automático.

La IA puede sugerir modificaciones.

No debe modificar el ground truth automáticamente.

---

# 29. VALIDACIÓN

Proceso:

```text
RAW DOCUMENT
 ↓
EXTRACTION
 ↓
AI STRUCTURING
 ↓
HUMAN REVIEW
 ↓
CORRECTION
 ↓
VERIFICATION
 ↓
INDEXING
```

---

# 30. ANONIMIZACIÓN

Si un despacho quiere utilizar un caso privado para investigación global:

```text
PRIVATE CASE
 ↓
PII DETECTION
 ↓
PII REMOVAL
 ↓
CONFIDENTIALITY REVIEW
 ↓
GENERALIZATION
 ↓
HUMAN REVIEW
 ↓
EXPLICIT APPROVAL
 ↓
ANONYMIZED COPY
```

Nunca modificar el original.

---

# 31. INFORMACIÓN SENSIBLE

Tratar con especial cuidado:

- nombres;
- DNI/NIE;
- direcciones;
- teléfonos;
- emails;
- información médica;
- información financiera;
- información laboral;
- información familiar;
- secretos empresariales;
- estrategia jurídica;
- comunicaciones abogado-cliente.

---

# 32. NOTAS DEL ABOGADO

Crear una categoría independiente:

```text
LAWYER_NOTE
```

Una nota puede tener:

```text
visibility:
LAWYER_ONLY
FIRM_CONFIDENTIAL
```

No debe entrar en:

```text
GLOBAL_PUBLIC
```

por defecto.

---

# 33. CALIDAD

Guardar:

```text
quality_score
completeness_score
verification_percentage
source_quality
extraction_quality
```

---

# 34. EJEMPLO JSON

```json
{
  "case_id": "CASE-0001",
  "source_type": "PUBLIC",
  "completeness_score": 64,
  "quality_score": 92,

  "outcome": {
    "result": "FAVORABLE",
    "verification_status": "VERIFIED"
  },

  "facts": [
    {
      "id": "FACT-001",
      "description": "El contrato contenía una cláusula X.",
      "status": "PROVEN",
      "verification_status": "VERIFIED",
      "source": {
        "document_id": "DOC-004",
        "page": 12
      }
    }
  ],

  "arguments": [
    {
      "id": "ARG-001",
      "description": "La cláusula X debía interpretarse de determinada forma.",
      "status": "ACCEPTED",
      "verification_status": "VERIFIED",
      "source": {
        "document_id": "DOC-007",
        "page": 34
      }
    }
  ],

  "evidence": [
    {
      "id": "EVD-001",
      "type": "DOCUMENTARY",
      "description": "Contrato firmado.",
      "weight": "HIGH",
      "verification_status": "VERIFIED",
      "source": {
        "document_id": "DOC-004",
        "page": 12
      }
    }
  ],

  "outcome_factors": [
    {
      "id": "FACTOR-001",
      "category": "EVIDENCE",
      "description": "Existencia del documento contractual original.",
      "impact": "POSITIVE",
      "importance": 5,
      "verification_status": "VERIFIED",
      "source": {
        "document_id": "DOC-004",
        "page": 12
      }
    }
  ]
}
```

---

# 35. REGLA DE CALIDAD MÁS IMPORTANTE

Nunca almacenar:

> "Esto hizo ganar el juicio."

si la fuente solamente permite afirmar:

> "Esta circunstancia fue considerada relevante por el tribunal."

La segunda afirmación es mucho más defendible.

---

# 36. DATASET INICIAL RECOMENDADO

Para el MVP:

```text
30-50 casos GOLDEN
+
50-100 casos públicos adicionales
```

No es necesario que todos estén completos.

Es más importante:

```text
calidad
+
diversidad
+
trazabilidad
+
verificación
```

que cantidad.

---

# 37. TEST SET

Reservar casos que la IA no utilice para ajustar manualmente prompts.

Separar:

```text
DEVELOPMENT
VALIDATION
TEST
```

---

# 38. OBJETIVO DEL DATASET

El dataset debe permitir eventualmente responder:

> ¿Qué ocurrió en casos similares?

> ¿Qué argumentos se utilizaron?

> ¿Qué pruebas existían?

> ¿Qué argumentos aceptó el tribunal?

> ¿Qué argumentos rechazó?

> ¿Qué diferencias existen entre casos?

> ¿Qué información falta en el caso actual?

> ¿Qué patrones aparecen históricamente?

Nunca presentar correlaciones como certezas causales.

---

# 39. SECRETO PROFESIONAL ABOGADO-CLIENTE (REFUERZO TÉCNICO)

La sección 31 ya identifica "comunicaciones abogado-cliente" como información sensible. Esto debe traducirse en una regla técnica, no solo organizativa:

```text
Ningún documento o chunk marcado como comunicación abogado-cliente
(privilegiada) puede:
 - generar embeddings compartidos entre organizaciones;
 - enviarse a un proveedor de IA/embeddings sin garantía contractual
   de no retención ni entrenamiento con esos datos;
 - incorporarse a GLOBAL_PUBLIC bajo ninguna circunstancia,
   ni siquiera anonimizado, salvo aprobación humana explícita caso por caso.
```

Esto es más estricto que el resto de `FIRM_CONFIDENTIAL`, porque el secreto profesional tiene protección legal reforzada (no es solo confidencialidad contractual).

---

# 40. RESPONSABILIDAD PROFESIONAL Y LÍMITES DEL DATASET

El dataset alimenta un sistema que sugiere argumentos, contraargumentos y factores de resultado a abogados en ejercicio. Esto tiene implicaciones de responsabilidad que el dataset debe soportar documentalmente:

```text
Cada Analysis y cada OutcomeFactor debe conservar:
 - qué modelo/versión de prompt lo generó;
 - qué fuentes lo respaldan (provenance);
 - si fue revisado por un humano y por quién.
```

Esto no sustituye el asesoramiento legal ni un seguro de responsabilidad civil del producto, pero es la base documental mínima para poder demostrar, ante una reclamación, qué dijo el sistema, con qué fuentes y con qué nivel de verificación en cada momento.

# END