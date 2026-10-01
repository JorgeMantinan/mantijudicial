# UI_UX.md --- Diseño de interfaz

## 1. Objetivo

Crear una interfaz para profesionales jurídicos que permita:

-   localizar información rápidamente;
-   entender el estado de un expediente;
-   revisar fuentes;
-   analizar argumentos;
-   comprobar qué información utilizó la IA.

------------------------------------------------------------------------

# 2. Estética

Características:

-   sobria;
-   institucional;
-   profesional;
-   limpia;
-   densa pero legible.

Evitar:

-   estética gaming;
-   gradientes excesivos;
-   glassmorphism dominante;
-   animaciones constantes;
-   exceso de colores;
-   dashboards llenos de métricas irrelevantes.

------------------------------------------------------------------------

# 3. Paleta

Base:

-   slate;
-   blanco/gris;
-   azul oscuro.

Semántica:

-   verde oscuro = favorable;
-   rojo oscuro = desfavorable/riesgo;
-   ámbar = advertencia;
-   azul = información;
-   dorado discreto = elemento destacado.

------------------------------------------------------------------------

# 4. Layout

Sidebar izquierda:

-   Dashboard
-   Casos
-   Documentos
-   Legislación
-   Jurisprudencia
-   IA
-   Compartidos
-   Actividad

Header:

-   búsqueda global;
-   selector de despacho;
-   notificaciones;
-   usuario.

------------------------------------------------------------------------

# 5. Dashboard

### Abogado

-   mis casos;
-   actividad reciente;
-   documentos procesándose;
-   análisis pendientes de revisar;
-   fechas próximas;
-   alertas.

### Despacho

-   casos compartidos;
-   actividad;
-   abogados;
-   permisos;
-   documentos pendientes.

------------------------------------------------------------------------

# 6. Lista de casos

Columnas:

-   referencia;
-   título;
-   cliente;
-   materia;
-   juzgado;
-   estado;
-   abogado;
-   última actividad.

Filtros:

-   materia;
-   estado;
-   abogado;
-   fecha;
-   prioridad;
-   compartido/privado.

------------------------------------------------------------------------

# 7. Caso

Header:

`Caso 2026/001 — Incumplimiento contractual`

Información rápida:

-   cliente;
-   contrario;
-   procedimiento;
-   juzgado;
-   estado;
-   abogado responsable.

Tabs:

Resumen Hechos Partes Pretensiones Documentos Pruebas Cronología
Legislación Jurisprudencia Argumentos Análisis IA Notas Actividad

------------------------------------------------------------------------

# 8. Resumen del caso

Mostrar:

### Situación actual

Qué está ocurriendo.

### Pretensiones

Lista de claims.

### Hechos clave

Solo los más importantes.

### Riesgos

Alertas.

### Información faltante

Datos pendientes.

### Último análisis IA

Fecha + estado de revisión.

------------------------------------------------------------------------

# 9. Documentos

Tabla:

-   nombre;
-   tipo;
-   fecha;
-   versión;
-   estado;
-   confidencialidad;
-   propietario;
-   acciones.

Acciones:

-   abrir;
-   descargar;
-   analizar;
-   compartir;
-   ver historial.

------------------------------------------------------------------------

# 10. Visor documental

Mostrar:

-   PDF;
-   texto/OCR;
-   páginas;
-   citas;
-   metadata.

Permitir:

`Abrir desde cita`

para que la IA pueda llevar al usuario al punto exacto.

------------------------------------------------------------------------

# 11. Hechos

Tabla:

-   hecho;
-   fecha;
-   estado;
-   importancia;
-   fuente;
-   quién lo afirma;
-   verificación.

Filtros:

-   probado;
-   alegado;
-   controvertido;
-   no probado.

------------------------------------------------------------------------

# 12. Pretensiones

Cada claim:

``` text
Pretensión
├── fundamento
├── evidencia
├── argumentos
├── jurisprudencia
└── resultado
```

Esto es preferible a una única etiqueta "ganado/perdido".

------------------------------------------------------------------------

# 13. Argumentos

Tarjetas:

### Favorable

### Desfavorable

### Parcial

### Contraargumento

Cada tarjeta muestra:

-   argumento;
-   fundamento;
-   evidencia;
-   jurisprudencia;
-   riesgos;
-   revisión.

------------------------------------------------------------------------

# 14. Análisis IA

La pantalla debe empezar por:

`¿Qué está analizando la IA?`

Mostrar contexto utilizado:

-   documentos;
-   hechos;
-   legislación;
-   jurisprudencia.

Después:

1.  Resumen
2.  Favorable
3.  Desfavorable
4.  Parcial
5.  Riesgos
6.  Contraargumentos
7.  Fuentes
8.  Información faltante

------------------------------------------------------------------------

# 15. Buscar jurisprudencia

Resultado:

-   sentencia;
-   tribunal;
-   fecha;
-   ECLI/ROJ;
-   similitud;
-   motivo de similitud;
-   resultado.

Acciones:

-   abrir;
-   comparar con caso;
-   añadir al caso;
-   citar.

------------------------------------------------------------------------

# 16. Comparador

Pantalla:

`Mi caso` vs `Sentencia`

Comparar:

-   hechos;
-   normativa;
-   argumentos;
-   pruebas;
-   diferencias;
-   resultado.

------------------------------------------------------------------------

# 17. Legislación

Navegación:

Código → Libro/Título → Capítulo → Artículo

Mostrar:

-   texto;
-   vigencia;
-   versiones;
-   referencias;
-   jurisprudencia relacionada.

------------------------------------------------------------------------

# 18. Compartir

Modal explícito:

Compartir con:

-   despacho;
-   abogado;
-   grupo.

Permisos:

-   Ver;
-   Descargar;
-   Editar;
-   Analizar;
-   Compartir;
-   Exportar.

Mostrar claramente:

`Privado` o `Compartido con X`

------------------------------------------------------------------------

# 19. UX de seguridad

Nunca esconder silenciosamente permisos.

Mostrar:

`Este documento es privado`

o:

`Compartido con Despacho X — Ver + Analizar`

------------------------------------------------------------------------

# 20. Mobile

Mobile debe permitir:

-   revisar casos;
-   consultar documentos;
-   revisar análisis;
-   recibir alertas.

La edición compleja de expedientes puede priorizar desktop.

# V2 --- Mejoras de UX

## Badges de procedencia

Incorporar badges visibles:

``` text
VERIFIED
SOURCE_CONFIRMED
AI_EXTRACTED
AI_INFERRED
UNKNOWN
```

Y de privacidad:

``` text
PUBLIC
CLIENT_CONFIDENTIAL
FIRM_CONFIDENTIAL
LAWYER_ONLY
RESTRICTED
```

## Completitud

En el caso mostrar:

``` text
Expediente
Completitud: 64%
```

pero acompañado de un desglose:

-   sentencia: disponible;
-   demanda: disponible;
-   contestación: no disponible;
-   pruebas: parcial;
-   recurso: desconocido.

Nunca presentar el porcentaje como calidad jurídica.

## Calidad

Separar visualmente:

-   completitud;
-   calidad de fuentes;
-   verificación.

## Casos similares

Cada resultado debe mostrar:

``` text
Por qué es similar
```

con factores:

-   hechos;
-   norma;
-   procedimiento;
-   pruebas;
-   tribunal;
-   fecha.

## Modo IA

Mostrar siempre:

``` text
Contexto:
[Este caso]
[Conocimiento público]
[Conocimiento del despacho]
```

Esto evita que el abogado piense que la respuesta procede de una fuente
cuando realmente procede de otra.

## Comparador

Añadir una vista:

``` text
CASO ACTUAL | CASO COMPARABLE
```

con:

-   hechos;
-   pretensiones;
-   pruebas;
-   argumentos;
-   normas;
-   tribunal;
-   resultado;
-   firmeza.

## Revisión

Cada resultado IA debe tener:

`Revisado por abogado`

y poder pasar por:

``` text
UNREVIEWED
REVIEWED
MODIFIED
REJECTED
```

## Caso demo

Añadir una señal visual inequívoca para:

`DEMO`

Los datos demo no deben confundirse con expedientes reales.


## Funcionalidad añadida (2026-09-30)

Vista de conjunto de lo implementado en la interfaz (además del diseño original):

- **Navegación**: píldoras con la pestaña activa, buscador en la cabecera, tema
  claro/oscuro y densidad de tablas con persistencia; atajos globales (`/`
  búsqueda, `a` alertas, `i` informes, `r` revisión, `N` siguiente pendiente,
  `?` ayuda).
- **Casos**: lista con filtros, chips y CSV, columna de revisión ordenable,
  ingesta múltiple con anti-duplicados (SHA-256), archivar/restaurar, secciones
  plegables, bloque "qué falta por concretar", actividad del caso, notas,
  compartir, comparar con cualquier caso, copiar enlace, impresión (ficha,
  dossier para el cliente, informe comparativo) y export JSON.
- **Análisis**: búsqueda con identificadores exactos (ECLI/ROJ/nº recurso),
  paginación, búsquedas guardadas con resaltado, sugerencias sin resultados,
  ficha de tema imprimible con desglose de argumentos y filtros, evolución con
  filtros y orden, patrones con criterio dividido y **tablas de frases por
  origen** (hechos/fundamentos/alegaciones), legislación con índice filtrable y
  orden por número BOE, plazos y alertas (vigencia con resumen del artículo,
  calidad, revisión).
- **Informes**: periodo con comparación A/B y delta, matriz tema × trimestre,
  filtros de rama/resultado, barras de proporción y CSV de
  casos/informes/temas/alertas.
- **Revisión**: selección múltiple, tablas ordenables, atajo N, progreso por
  rama, carga por persona y auditoría filtrable por acción y persona.
- **Ayuda**: `/ayuda`, `/novedades`, `/resumen` imprimible, 404 en castellano
  y `/eval` (renombrado "Calidad" en el menú) con coste en vivo, calidad del
  corpus, sistema y tiempos de render.
- **Impresión**: cabeceras de tabla repetidas, sin partir filas ni listas,
  secciones plegadas que en papel salen enteras y sumario del dossier.
