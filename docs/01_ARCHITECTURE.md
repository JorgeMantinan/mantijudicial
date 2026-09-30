# Plataforma jurídica --- Arquitectura

## 1. Objetivo

Construir una plataforma web profesional para despachos de abogados y
abogados individuales que permita gestionar expedientes judiciales,
almacenar documentos, consultar legislación y jurisprudencia y utilizar
IA para analizar casos con trazabilidad de las fuentes.

La prueba piloto será de Derecho civil, pero la arquitectura debe estar
preparada desde el principio para Civil, Penal, Laboral, Mercantil,
Administrativo, Constitucional, Familia, Procesal,
Contencioso-administrativo y otras áreas.

La plataforma debe actuar como **sistema de expediente + motor
jurídico + asistente de análisis**, no simplemente como un chatbot.

------------------------------------------------------------------------

## 2. Decisión fundamental: separar tres tipos de conocimiento

La aplicación tendrá tres universos independientes:

1.  **PUBLIC LEGAL KNOWLEDGE**
    -   legislación;
    -   jurisprudencia;
    -   fuentes jurídicas públicas.
2.  **FIRM KNOWLEDGE**
    -   información que el despacho decide compartir;
    -   plantillas;
    -   doctrina interna;
    -   documentos compartidos.
3.  **PRIVATE CASE KNOWLEDGE**
    -   expedientes;
    -   documentos;
    -   pruebas;
    -   notas;
    -   información privada del abogado.

Nunca deben mezclarse sin aplicar autorización.

------------------------------------------------------------------------

## 3. Unidad central: el caso

La pieza central es `Case`.

Jerarquía:

User → Firm → Members → Cases → Documents → Evidence → Timeline → Legal
sources → Analysis

Un abogado puede existir sin despacho.

Un abogado puede pertenecer a un despacho y seguir teniendo casos
privados.

Pertenecer a un despacho NO implica acceso automático a todos los casos
del abogado.

------------------------------------------------------------------------

## 4. Roles

### LAWYER

Puede crear y gestionar sus casos, documentos y análisis.

### FIRM_ADMIN

Administra miembros, invitaciones, permisos y recursos propiedad del
despacho.

### FIRM_MEMBER

Accede únicamente a los recursos del despacho que tenga autorizados.

### PLATFORM_ADMIN

Administración técnica de la plataforma. No debe tener acceso automático
al contenido jurídico privado.

------------------------------------------------------------------------

## 5. Propiedad

Cada recurso debe tener propietario explícito.

Ejemplos:

-   usuario;
-   despacho;
-   sistema público.

No utilizar la pertenencia al despacho como sustituto de propiedad.

------------------------------------------------------------------------

## 6. Privacidad

Valores recomendados:

-   PRIVATE
-   FIRM_SHARED
-   USER_SHARED
-   CASE_SHARED
-   PUBLIC_KNOWLEDGE

Por defecto:

`PRIVATE`

------------------------------------------------------------------------

## 7. Frontend

Mantener:

-   Next.js App Router;
-   React;
-   TypeScript strict;
-   Tailwind;
-   shadcn/ui;
-   Radix;
-   Lucide;
-   React Hook Form;
-   Zod;
-   Vitest;
-   Playwright;
-   i18n.

Eliminar del frontend todo dominio fiscal/gestoría.

------------------------------------------------------------------------

## 8. Backend y datos

Mantener:

-   Supabase Auth;
-   PostgreSQL;
-   Prisma;
-   RLS;
-   Supabase Storage;
-   Redis/Upstash;
-   Sentry;
-   Resend;
-   Stripe si la aplicación será SaaS.

La autorización debe existir en servicios de aplicación y también como
defensa de base de datos.

------------------------------------------------------------------------

## 9. Storage

Los documentos jurídicos deben estar en buckets privados.

Nunca usar URLs públicas permanentes.

Descarga:

request → authorization → signed URL de duración corta → descarga

------------------------------------------------------------------------

## 10. Caso

Un caso debe poder contener:

-   identificación;
-   jurisdicción;
-   área jurídica;
-   tipo de procedimiento;
-   juzgado;
-   número de procedimiento;
-   partes;
-   representante;
-   pretensiones;
-   hechos;
-   pruebas;
-   documentos;
-   cronología;
-   legislación;
-   jurisprudencia;
-   argumentos;
-   riesgos;
-   contraargumentos;
-   información faltante;
-   análisis IA;
-   actividad.

------------------------------------------------------------------------

## 11. Diseño

Estética:

-   profesional;
-   institucional;
-   sobria;
-   alta legibilidad;
-   escritorio como prioridad;
-   responsive;
-   sin exceso de animaciones.

Paleta sugerida:

-   fondo gris/slate muy claro;
-   texto slate oscuro;
-   azul institucional oscuro;
-   azul grisáceo;
-   dorado/bronce discreto;
-   verde oscuro para favorable;
-   ámbar para advertencias;
-   rojo oscuro para riesgos.

No copiar literalmente la identidad visual de ninguna institución.

------------------------------------------------------------------------

## 12. Navegación

### Abogado

-   Dashboard
-   Casos
-   Documentos
-   Jurisprudencia
-   Legislación
-   Análisis IA
-   Tareas
-   Compartidos
-   Actividad
-   Configuración

### Despacho

-   Dashboard
-   Casos
-   Abogados
-   Documentos
-   Legislación
-   Jurisprudencia
-   Análisis
-   Compartidos
-   Auditoría
-   Configuración

------------------------------------------------------------------------

## 13. Pantalla del caso

Header:

-   nombre;
-   referencia;
-   juzgado;
-   estado;
-   abogado responsable.

Tabs:

-   Resumen
-   Hechos
-   Partes
-   Pretensiones
-   Documentos
-   Pruebas
-   Cronología
-   Legislación
-   Jurisprudencia
-   Argumentos
-   Análisis IA
-   Notas
-   Actividad

Panel lateral:

-   alertas;
-   fechas;
-   información faltante;
-   riesgos.

------------------------------------------------------------------------

## 14. Principio de UX

La pregunta que debe responder la interfaz es:

> ¿Qué necesito saber sobre este caso?

El abogado debe poder pasar rápidamente de:

Caso → Argumento → Fuente → Documento original.

La IA nunca debe ser la única interfaz de análisis.

# V2 --- Cambios incorporados de la documentación antigua

Los documentos antiguos introducen una mejora importante: la plataforma
debe modelarse como **multi-tenant con tres ámbitos de conocimiento**:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

Esto se incorpora a la arquitectura actual.

Además, la arquitectura debe separar explícitamente:

``` text
public legal knowledge
firm knowledge
private case knowledge
lawyer-only notes
```

### Abstracciones técnicas obligatorias

La arquitectura debe desacoplar:

-   `AIProvider`
-   `EmbeddingProvider`
-   `OCRProvider`
-   `StorageProvider`
-   `SearchProvider` cuando sea conveniente.

### Nueva prioridad

La jerarquía arquitectónica pasa a ser:

``` text
SECURITY
>
PROVENANCE
>
DATA QUALITY
>
CORRECTNESS
>
USABILITY
>
SPEED
>
VISUAL EFFECTS
```

### Casos y jurisprudencia

La arquitectura antigua trataba `Case` como entidad general. En esta
versión se mantiene la separación:

-   `Case` = expediente del cliente/usuario.
-   `JudicialDecision` = resolución judicial pública o incorporada como
    fuente.

### Nuevo concepto: completeness

Cada caso debe distinguir:

-   `completeness`;
-   `quality`;
-   `verification`.

Un expediente incompleto no significa que los hechos ausentes no
ocurrieran.

### Firmeza y jerarquía judicial

Las decisiones deben conservar:

-   `finalityStatus`;
-   `courtHierarchyLevel`.

Las funcionalidades de casos similares, patrones y outcome factors deben
poder filtrar/ponderar estos datos.

### Resultado

La arquitectura antigua no sustituye la nueva; la mejora. Sus conceptos
de provenance, multi-tenancy, knowledge scopes y evaluation deben
considerarse requisitos de arquitectura.
