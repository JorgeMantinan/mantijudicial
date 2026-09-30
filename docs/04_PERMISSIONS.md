# PERMISSIONS.md --- Seguridad y permisos

## 1. Principio

DENY BY DEFAULT.

No existe acceso simplemente por:

-   ser abogado;
-   pertenecer al despacho;
-   conocer el ID;
-   tener una URL;
-   conocer el nombre del documento.

------------------------------------------------------------------------

# 2. Propiedad

Recursos privados:

-   propietario usuario;
-   propietario despacho.

Recursos públicos:

-   conocimiento jurídico público.

------------------------------------------------------------------------

# 3. Matriz conceptual

  Recurso                   Abogado propietario   Despacho        Otro abogado
  ------------------------- --------------------- --------------- ---------------
  Caso privado              Sí                    No              No
  Documento privado         Sí                    No              No
  Caso compartido           Sí                    Según permiso   Según permiso
  Documento compartido      Sí                    Según permiso   Según permiso
  Caso propiedad despacho   Según rol             Sí              Según permiso
  Legislación pública       Sí                    Sí              Sí
  Jurisprudencia pública    Sí                    Sí              Sí

------------------------------------------------------------------------

# 4. Compartición abogado → despacho

Un abogado selecciona:

`Compartir con despacho`

Debe poder elegir:

-   ver;
-   descargar;
-   editar;
-   analizar;
-   compartir;
-   exportar.

No todos los permisos deben venir activados.

------------------------------------------------------------------------

# 5. Compartición despacho → abogado

El despacho puede compartir:

-   caso;
-   documento;
-   carpeta/colección;
-   conocimiento interno.

El abogado recibe únicamente el permiso concedido.

------------------------------------------------------------------------

# 6. Revocación

Cuando se revoca:

-   nuevas peticiones deben fallar;
-   retrieval debe dejar de incluir el recurso;
-   signed URLs deben tener expiración corta;
-   la acción debe quedar auditada.

------------------------------------------------------------------------

# 7. RLS

La base de datos debe tener RLS como defensa adicional.

No depender únicamente de Prisma ni del frontend.

------------------------------------------------------------------------

# 8. Storage

No usar:

`public bucket`

para expedientes.

Usar:

`private bucket`

y acceso mediante backend + signed URL temporal.

------------------------------------------------------------------------

# 9. IA

La autorización se ejecuta antes del retrieval.

Incorrecto:

retrieve todo → IA → filtrar después.

Correcto:

usuario → autorización → fuentes autorizadas → retrieval → contexto →
IA.

------------------------------------------------------------------------

# 10. Búsqueda

La búsqueda también debe respetar permisos.

Un usuario no debe poder descubrir mediante:

-   títulos;
-   snippets;
-   resultados semánticos;
-   embeddings;
-   metadatos;

que existe un caso privado que no puede ver.

------------------------------------------------------------------------

# 11. Exportación

Exportar un expediente requiere permiso explícito:

`EXPORT`

La exportación debe quedar auditada.

------------------------------------------------------------------------

# 12. Administradores

Un `FIRM_ADMIN` no debe tener acceso universal a los casos privados de
los abogados.

Un `PLATFORM_ADMIN` tampoco debe tener acceso automático al contenido
jurídico.

Cualquier acceso excepcional debe ser:

-   explícito;
-   limitado;
-   auditado;
-   justificado.

------------------------------------------------------------------------

# 13. Permisos futuros

Preparar el sistema para:

-   permisos por caso;
-   permisos por documento;
-   permisos por colección;
-   expiración;
-   permisos temporales;
-   grupos internos.

------------------------------------------------------------------------

# 14. Pruebas obligatorias

Test:

A comparte → B ve.

A revoca → B no ve.

A no comparte → B no descubre.

A comparte solo VIEW → B no puede EDIT.

A comparte VIEW+ANALYZE → B puede analizar, pero no descargar si
DOWNLOAD no está concedido.

El retrieval IA debe respetar exactamente la misma matriz.

# V2 --- Mejoras de permisos de la documentación antigua

## Knowledge scopes

Añadir explícitamente:

``` text
GLOBAL_PUBLIC
ORGANIZATION_PRIVATE
LAWYER_PRIVATE
```

Esto es distinto de los permisos.

`scope` indica el ámbito conceptual.

`Permission` indica quién puede realizar qué acción.

## Privacidad

Mantener:

``` text
PUBLIC
CLIENT_CONFIDENTIAL
FIRM_CONFIDENTIAL
LAWYER_ONLY
RESTRICTED
```

pero hacer que afecte técnicamente a:

-   búsqueda;
-   retrieval;
-   descarga;
-   export;
-   IA;
-   sharing.

## Notas del abogado

Las notas de estrategia deben ser `LAWYER_ONLY` por defecto.

No incluirlas automáticamente en:

-   búsqueda del despacho;
-   estadísticas globales;
-   RAG global;
-   datasets;
-   otros despachos.

## Multi-organización

Un usuario puede pertenecer a más de un despacho.

Por ello nunca utilizar solamente:

``` text
userId → firmId
```

Debe existir:

``` text
User
  ↓
FirmMembership
  ↓
Firm
```

## Permisos de IA

Añadir explícitamente:

`ANALYZE`

pero comprobarlo antes del retrieval.

Ejemplo:

``` text
VIEW = sí
DOWNLOAD = no
ANALYZE = sí
```

El usuario puede analizar un recurso sin poder descargar el original si
esa es la política elegida.

## Revocación

La revocación debe afectar inmediatamente a:

-   UI;
-   API;
-   signed URLs nuevas;
-   búsqueda;
-   vector search;
-   RAG.

## Test adicional

Un usuario no autorizado no debe poder descubrir ni siquiera la
existencia del recurso mediante:

-   título;
-   metadata;
-   snippets;
-   embeddings;
-   respuestas del LLM.
