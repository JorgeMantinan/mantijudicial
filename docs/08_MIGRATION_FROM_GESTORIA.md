# MIGRATION_FROM_GESTORIA.md --- Reutilización del proyecto existente

## 1. Objetivo

Reutilizar el core técnico del proyecto de gestoría sin heredar su
modelo de negocio.

------------------------------------------------------------------------

# 2. Mantener

### Monorepo

-   Turborepo
-   pnpm
-   packages
-   apps

### Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind
-   shadcn/ui
-   Radix
-   Lucide
-   React Hook Form
-   Zod

### Testing

-   Vitest
-   Playwright

### Infraestructura

-   Supabase
-   PostgreSQL
-   Prisma
-   RLS
-   Storage
-   Redis/Upstash
-   Sentry
-   Resend

### SaaS

-   Stripe si aplica.

### Internacionalización

Mantener i18n.

------------------------------------------------------------------------

# 3. Eliminar

No migrar:

-   facturas;
-   nóminas;
-   IVA;
-   IRPF;
-   RETA;
-   IS;
-   patrimonio;
-   conciliación;
-   Hacienda;
-   dataset fiscal;
-   facturas por IMAP;
-   lógica gestor/gestionado.

------------------------------------------------------------------------

# 4. Refactor principal

Actualmente:

`Perfil → gestor/gestionado`

Nueva arquitectura:

`User → FirmMembership → Firm`

y:

`User → PrivateCases`

------------------------------------------------------------------------

# 5. Supabase Auth

Mantener autenticación.

Revisar:

-   callbacks;
-   sesiones;
-   cookies;
-   OAuth;
-   middleware.

Preparar:

-   MFA;
-   recuperación;
-   invitaciones.

------------------------------------------------------------------------

# 6. Prisma

Crear un nuevo schema jurídico.

No conservar 49 modelos fiscales solo por comodidad.

Preferible:

-   nuevo schema;
-   migración limpia;
-   paquetes reutilizables.

------------------------------------------------------------------------

# 7. packages/utils

Conservar utilidades genéricas.

Eliminar lógica fiscal.

Crear:

-   authorization;
-   legal parsing;
-   document processing;
-   AI schemas;
-   citations;
-   permissions.

------------------------------------------------------------------------

# 8. packages/types

Crear tipos compartidos:

-   UserRole;
-   FirmRole;
-   CaseStatus;
-   CaseParty;
-   Claim;
-   Fact;
-   Evidence;
-   Argument;
-   LegalSource;
-   JudicialDecision;
-   AIAnalysis.

------------------------------------------------------------------------

# 9. packages/database

Nuevo schema.

Separar:

public legal data de private tenant data.

------------------------------------------------------------------------

# 10. AI

Mantener el wrapper Claude existente si es útil.

Pero convertirlo en:

`AIProvider`

La lógica de análisis jurídico debe estar fuera del proveedor.

------------------------------------------------------------------------

# 11. Stripe

No mezclar:

subscription logic

con:

legal domain.

Crear módulo:

`billing`

independiente.

------------------------------------------------------------------------

# 12. Exportación

Mantener PDF/XLSX/ZIP si se necesita.

Pero crear exports específicos:

-   expediente;
-   informe;
-   timeline;
-   análisis;
-   evidencias.

------------------------------------------------------------------------

# 13. PWA

Mantener solo si el uso móvil aporta valor.

No debe bloquear el MVP.

------------------------------------------------------------------------

# 14. Migración de datos del piloto

El ZIP actual contiene tres resoluciones judiciales públicas con:

-   metadata;
-   PDF original;
-   hechos;
-   argumentos.

Esas entidades deben migrarse a:

`JudicialDecision`

y no a `Case`.

------------------------------------------------------------------------

# 15. Problema semántico actual

Actualmente se utiliza:

`CASE-000001`

para una sentencia.

Esto debe cambiar.

Propuesta:

`JD-000001`

para `JudicialDecision`.

Los casos de usuarios:

`CASE-2026-000001`

------------------------------------------------------------------------

# 16. Mapeo de argumentos

Actualmente:

`arguments[].sources[].document_id`

usa el ID del caso como fuente.

Cambiar a:

`SourceReference`

con:

-   sourceType;
-   judicialDecisionId;
-   documentId;
-   page;
-   paragraph;
-   locator.

------------------------------------------------------------------------

# 17. Mapeo de facts

Mantener:

-   description;
-   fact_type;
-   status;
-   importance;
-   confidence;
-   verification_status.

Añadir:

-   assertedByParty;
-   verifiedBy;
-   verifiedAt;
-   sourceReference.

------------------------------------------------------------------------

# 18. Confianza

Actualmente:

`confidence: 0.95`

Debe documentarse como:

`extractionConfidence`

No como probabilidad de veracidad.

------------------------------------------------------------------------

# 19. Reutilización de UI

Reutilizar:

-   sidebar;
-   layouts;
-   formularios;
-   modals;
-   toast;
-   tables;
-   auth pages;
-   theme;
-   responsive utilities.

No reutilizar directamente pantallas de gestoría.

------------------------------------------------------------------------

# 20. Reutilización del core de seguridad

Revisar y aprovechar:

-   RLS;
-   rate limiting;
-   audit;
-   session management;
-   Storage;
-   Sentry.

Pero volver a auditar todo.

No asumir que una política creada para gestoría es segura para
expedientes jurídicos.

------------------------------------------------------------------------

# 21. Resultado esperado

El nuevo proyecto debe parecer una aplicación nueva.

Debe compartir infraestructura y patrones técnicos con la aplicación
anterior, pero no debe parecer una gestoría adaptada.

# V2 --- Nuevos elementos a rescatar del proyecto antiguo

Los documentos antiguos confirman que el core de gestoría puede
reutilizarse incluso mejor de lo previsto, pero hay que conservar
solamente infraestructura genérica.

## Reutilizar

-   auth;
-   multi-tenant patterns;
-   RLS;
-   rate limiting;
-   audit;
-   storage;
-   email;
-   Stripe;
-   Sentry;
-   testing;
-   i18n;
-   provider wrappers.

## No reutilizar

-   perfiles gestor/gestionado;
-   fiscal;
-   facturación;
-   modelos fiscales;
-   workflows de Hacienda.

## Cambio de arquitectura

El antiguo sistema de perfiles no debe convertirse simplemente en:

``` text
gestor → despacho
gestionado → abogado
```

Debe refactorizarse a:

``` text
User
├── FirmMembership[]
└── PrivateResources[]
```

## Datos públicos

El nuevo sistema debe tener un espacio de conocimiento público separado
de los tenants.

Esto evita que el modelo de gestoría, diseñado alrededor de perfiles
privados, limite el motor jurídico.

## Dataset

Los datos de jurisprudencia pública no deben mezclarse físicamente con
documentos privados de clientes.

Separar claramente:

``` text
PUBLIC LEGAL KNOWLEDGE
PRIVATE TENANT DATA
```

## Resultado

La reutilización más valiosa del proyecto anterior es el core de
infraestructura, no el modelo de dominio.
