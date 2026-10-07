# PROBLEMAS Y LIMITES DE LA IDEA INICIAL

Documento aparte (no es un plan de ejecución): aquí quedan registrados los
problemas, riesgos y límites detectados en la idea original, para que no se
pierdan y para que se revisen antes de cada fase.

Fecha de elaboración: 2026-09-29.

---

## 1. DATOS Y CORPUS

### 1.1 El corpus no es el que decía la guía de descarga

`GUIA_DESCARGA_CASOS_CIVIL.md` preveía una mezcla de ~25-30 casos del
Tribunal Supremo, ~45-50 de Audiencias Provinciales y algunos TSJ, repartidos
en 4 ramas (contractual, cláusulas abusivas, arrendamientos, responsabilidad
civil). La realidad comprobada en los PDFs (metadatos `/Subject` de los 80
ficheros) es:

- **80/80 son Tribunal Supremo, Sala de lo Civil.**
- Cero Audiencias Provinciales, cero TSJ, cero penal.

**Consecuencia:** cualquier "patrón de ganar/perder" derivado de este corpus
es patrón de **casación del TS**, no de juzgados de primera instancia ni de
Audiencias. El 95%+ de los pleitos de un despacho se juegan en instancia y
apelación, que este corpus no refleja. No extrapolable sin advertirlo.

### 1.2 Duplicados reales

4 ECLIs aparecen en dos carpetas cada uno (PDF distintos, mismo contenido
probable):

| ECLI | Carpetas |
|---|---|
| ES:TS:2026:3359 | case_000010, case_000012 |
| ES:TS:2026:3371 | case_000007, case_000056 |
| ES:TS:2026:3375 | case_000011, case_000057 |
| ES:TS:2026:3708 | case_000033, case_000041 |

Corpus real: **76 sentencias únicas**. Si no se deduplican, los recuentos de
patrones quedan inflados artificialmente.

### 1.3 Procesamiento casi completo (79/80)

Los 80 casos tienen `metadata/`; **79/80 tienen también `structured/`**
(enriquecidos). El único que falta es `case_000056`, descartado por corrupto y
que no se reintenta sin permiso nuevo. El índice maestro (manifest) sí existe:
`pipeline/lib/manifest.ts`, con `sha256` del PDF y estado `enriched` por caso.

### 1.4 Muestra pequeña y concentrada

- 76 casos, de los cuales los 8 ya analizados son 100% CONTRACTUAL.
- Fechas concentradas (predomina 2026).
- Con esto **no se pueden afirmar** "el sistema detecta patrones
  estadísticos". Sí se puede: "muestra de doctrina del TS con ejemplos
  representativos". La documentación antigua ya lo advertía: 30-50 casos es
  dataset para prototipar, no para predicción.

### 1.5 Techo legal del corpus público (<100)

Límite legal actual: uso no comercial + ocasional + menos de 100
resoluciones (ver apartado 3). **No hay camino gratis y legal para ampliar
el corpus público de jurisprudencia por encima de 100 sin licencia del
CENDOJ** (de pago). Crecer en datos solo es posible por dos vías:

1. **Casos que suben los propios abogados** (datos del despacho, sin
   problema de licencia) → es el activo real del producto.
2. Licencia-tipo del CENDOJ si algún día se quiere corpus público mayor
   (presupuestar: tiene precio público).

### 1.6 Inconsistencias de formato en los datos existentes

- `case_000001/metadata/case_000001.json` vs `CASE-00000N_case.json` en el
  resto (nombres dispares).
- `CASE-000001` es en realidad una sentencia pública; según
  `01_ARCHITECTURE.md` y `10_OPEN_CODE_MASTER_PROMPT.md` debería migrar a
  `JD-000001` (JudicialDecision), reservando `Case` para expedientes de
  clientes. Hoy conviven los dos conceptos con el mismo prefijo.
- `arguments[].sources[].document_id` apunta al propio caso, no a un
  `SourceReference` real (deuda de migración ya anotada en docs).

---

## 2. MODELO DE DATOS: LO QUE FALTA

### 2.1 No hay resultado (outcome) y sin él no hay patrones

La idea central es detectar "ganar / perder / ganar parcialmente". **Ningún
fichero existente guarda el fallo.** Falta:

- resultado del recurso (estimado / desestimado / parcialmente estimado);
- resultado por pretensión (concedida / desestimada / parcial);
- quién quedó mejor parado en cada instancia;
- firmeza (recurso posterior, si lo hay).

Sin esto, "ganar/perder" es una intuición, no un dato.

### 2.2 Solo 2 ficheros de estructurado: insuficiente

Hoy: `facts.json` (siempre 5 hechos) y `arguments.json` (4-5). No hay:
partes, pretensiones, cronología, fundamentos jurídicos del tribunal
(ratio decidendi), leyes citadas normalizadas, jurisprudencia citada,
cuestiones planteadas (issues), resumen, evidencia, ni revisión humana.

### 2.3 Citas legales en texto libre

`legal_basis` = "Art. 1124 CC en relación con...". Cadena libre, imposible
de cruzar programáticamente con el BOE, imposible de contar frecuencias de
artículos, imposible de verificar si la cita es correcta.

### 2.4 Procedencia y revisión

Todo está marcado `AI_EXTRACTED` sin:

- estado de revisión del abogado (REVIEWED / MODIFIED / REJECTED);
- modelo, versión de prompt y fecha de la extracción;
- ground truth / golden set con el que medir la calidad de extracción.

---

## 3. LEGALIDAD (lo más importante de este documento)

### 3.1 Jurisprudencia (CENDOJ) — el riesgo principal

Marco: Ley 37/2007 de reutilización de la información del sector público +
Reglamento 3/2010 del CGPJ (anulado en parte por sentencia del TS de
2011/10/28, sin reglamento sustituto específico) + condiciones de uso de la
base de datos CENDOJ.

Reglas prácticas resultantes (mínimo prudente):

- **Consulta libre para uso particular.** Meramente consultar conocimiento
  personal no es reutilización.
- **No descarga masiva** de la base de datos CENDOJ: expresamente
  prohibida en sus condiciones de uso.
- **Uso comercial prohibido sin licencia.** Anuncio del CGPJ: "No está
  permitida la utilización de la base de datos para usos comerciales, ni la
  descarga masiva de información. La reutilización ... para la elaboración
  de bases de datos o con fines comerciales debe seguir el procedimiento ...
  del CGPJ a través del CENDOJ".
- **Umbral de 100 resoluciones**: el art. 4.2 del Reglamento 3/2010 exime
  de licencia solo si la reutilización es *ocasional* + *escasa entidad*
  (**< 100 resoluciones**) + *sin finalidad comercial* (las tres a la vez).
  Superar eso o comercializar → licencia-tipo con posible precio público.
- Sanciones: el reglamento contempla multas (10.000 a 100.000 €).
- **Obligación de citar fuente y fecha** en cada resolución reutilizada.
- **Disociación de datos personales** cuando el material los contenga.

**Situación actual del proyecto:** 80 sentencias descargadas manualmente,
una a una, con registro de sesión, en fase de demo no comercial, por debajo
de 100. Es coherente con el umbral, pero **no es un permiso permanente**: en
cuanto el producto se comercialice o se pase de 100, toca pedir licencia al
CENDOJ. Mantener trazabilidad de cada descarga (fecha, motivo, sha256).

**Ruta 100% limpia a largo plazo:** el corpus público se queda como
"sentencias citadas/enlazadas + semilla de doctrina", y el corpus de trabajo
crece con los casos que los propios despachos suben (datos propios, con
contrato y consentimiento).

### 3.2 Legislación (BOE) — permisivo, con condiciones

La API de datos abiertos del BOE está creada expresamente para reutilización
comercial y no comercial (licencia tipo, Resolución de 27/06/2024).
Obligaciones:

- citar la fuente: "Basado en datos de la Agencia Estatal Boletín Oficial
  del Estado";
- en textos consolidados, indicar expresamente que son **"de carácter
  meramente informativo"** (no oficial) en cada texto reutilizado;
- conservar metadatos de fecha de actualización;
- respetar el RGPD si hay datos personales;
- no sugerir patrocinio/oficialidad del BOE.

Además, el BOE puede suspender accesos que incumplan condiciones; no publica
límite de peticiones explícito → descargar con cortesía (ver 3.6).

### 3.3 Protección de datos (RGPD / LOPDGDD)

- Las sentencias publicadas por el CENDOJ vienen ya **disociadas**, pero
  pueden contener datos (nombres de partes en sentencias no anónimas): su
  tratamiento exige base legal, minimización y seguridad.
- **Casos subidos por abogados = datos de clientes con datos personales y
  probablemente categorías especiales** (salud, familia): aquí aplica el
  RGPD a pleno rendimiento → DPIA, cifrado, control de acceso, retención,
  contrato de encargado con cualquier proveedor de IA externo.
- Nunca enviar datos identificativos de clientes a un proveedor de IA sin
  base legal/encargo; idealmente anonimizar antes de enviar.

### 3.4 Secreto profesional

Art. 542.3 LOPJ y Código Deontológico de la Abogacía (Resolución 2/2023
CGAE): los datos del despacho son secretos profesional. Consecuencia para el
diseño: separación estricta corpus público vs. casos del despacho vs. casos
privados de cada abogado (los knowledge scopes de tus docs), sin acceso
automático del administrador del despacho a casos ajenos.

### 3.5 Publicidad y promesas de resultado

- Código Deontológico: la publicidad del abogado no puede inducir a error
  ni prometer resultados.
- Tus propios docs ya lo prohíben: no presentar la plataforma como
  "IA que sabe quién ganará", no ofrecer "probabilidad de ganar".
- Salida permitida: "líneas de análisis posibles, con fuentes, revisadas
  por el abogado". Añadir aviso legal: **herramienta de apoyo, no
  asesoramiento jurídico**.
- Posible aplicación del Reglamento (UE) 2024/1689 (AI Act): los sistemas
  destinados a asistir a autoridades judiciales en la interpretación de
  normas y hechos pueden ser de alto riesgo (Anexo III.8); los dirigidos a
  abogados como apoyo conviene evaluarlos antes de comercializar. Revisar
  cuando haya producto en el mercado.

### 3.6 Descargas del BOE sin bloqueo de IP

El BOE no publica límite de tasa fijo. Estrategia segura a implementar:

- 1 sola llamada al catálogo completo (`limit=-1`);
- texto completo **por norma** (`/id/{id}/texto`, ~1 petición por norma,
  no 1 por artículo: evitaría miles de peticiones);
- peticiones secuenciales con retardo (≈1/s), User-Agent identificativo,
  reintentos con backoff ante 429/5xx, caché local e incremental por
  fechas (`from=AAAAMMDD`);
- total inicial estimado: ~50-100 peticiones → irrelevante para un servidor
  público.

---

## 4. IA: RIESGOS TÉCNICOS Y DE CONTENIDO

### 4.1 Alucinaciones

Puede inventar artículos, ECLIs, fechas o folios. Mitigación obligatoria:
todo dato estructurado importante se verifica contra fuente (texto BOE,
metadatos del PDF, índice de bloques) antes de mostrarlo; si no hay fuente:
"No se ha encontrado una fuente suficiente".

### 4.2 Prompt injection

Los PDFs son contenido no confiable (pueden contener instrucciones). Los
documentos recuperados nunca son instrucciones: separar SYSTEM / USER /
RETRIEVED_DATA.

### 4.3 Confianza ≠ probabilidad

`confidence 0.95` de extracción **no** es 95% de ganar. Mantener separados
`extractionConfidence`, `legalAssessmentConfidence` y
`factVerificationStatus`. No construir scores de éxito en el MVP.

### 4.4 Proveedor y coste

Decisión tomada: proveedor = modelo del propio opencode (MiMo v2.6) vía CLI.
Riesgos: disponibilidad/costo variable, latencia para 80 extracciones
múltiples, y dependencia de un proveedor. Mitigación: abstracción
`AIProvider` + `MockProvider`, piloto de 3 casos antes de lote completo,
registro de tokens/timestamps.

### 4.5 Calidad sin ground truth

Sin casos de referencia revisados a mano no se puede saber si la extracción
mejora o empeora. Hace falta un golden set pequeño (8-10 sentencias
revisadas manualmente) y tests de extracción.

---

## 5. PRODUCTO Y NEGOCIO

1. **El valor inmediato no es "predecir"**: con 76 casos de casación, el
   MVP útil es: leyes aplicables detectadas + argumentos comparados +
   jurisprudencia cercana + checklist de lo que falta. Los patrones de
   resultado son experimento secundario, siempre con conteos y advertencias.
2. **Corpus público con techo legal** (apartado 3): el crecimiento está en
   los casos que suban los despachos; diseñar la ingesta para que un caso
   ajeno entre igual que un PDF de CENDOJ.
3. **Sobre-ingeniería**: la doc V2 (multi-tenant, RLS, billing, golden
   dataset, benchmark) es correcta como destino, pero aplicarla toda antes
   de tener datos reales retrasa el primer valor entregable. Orden:
   datos → cruces → web → permisos → billing.
4. **Ética/estatuto**: toda salida de la IA marcada como inferencia, con
   revisión obligatoria del abogado antes de usarse frente a un cliente.
5. **Dependencia de fuentes externas**: caída de la API del BOE o cambios
   en CENDOJ deben degradar el servicio, no romperlo (cacheado local).

---

## 6. DEUDA TÉCNICA HEREDADA (pendiente de resolver)

- Renombrar `CASE-000001` → `JD-000001` en el momento de migrar a BD.
- Unificar nombres de ficheros de metadata.
- `extracted/judgment.txt` planificado en la guía y nunca creado.
- ~~Sin manifest maestro~~ ✅ hecho: `pipeline/lib/manifest.ts` (hash y estado
  por caso).
- Sin `verification/review.json` (revisión de firmeza y datos de ficha).
- Codificación: los JSON están bien en UTF-8 (la corrupción visible en
  PowerShell 5.1 es solo de consola); usar siempre UTF-8 sin BOM y leer con
  `Read`/`cat` adecuados.

---

## REGLA DE ORO DEL PROYECTO

> Nada de obtener más datos de los que la ley permite "porque luego no se
> nota". Todo dato tiene: fuente, fecha, base de uso y, cuando toque,
> licencia. Si un paso legal es ambiguo: paramos, documentamos la
> ambigüedad y consultamos.


## Estado de los límites (2026-09-30)

- **Sin despliegue**: Render preparado (`render.yaml`, `scripts/render-bootstrap.sh`
  y rama `data` con el corpus) sin contratar; Vercel descartado (proyecto
  eliminado). Todo corre en local (`pnpm web`).
- **Identidad** en `data/identity.json` sobre el disco: Supabase sin cupo;
  `supabase/schema.sql` listo para cuando haya proyecto (el cambio es solo la
  capa `IdentityStore`; `lib/authorization.ts` no cambia).
- **IA**: proveedor `opencode` en local; coste visible en `/eval` ("Coste en
  vivo"). Para servidor ya existe el proveedor HTTP compatible con OpenAI
  (`AI_API_KEY` + `AI_BASE_URL` + `AI_MODEL` en `render.yaml`).
- **Embeddings / búsqueda semántica**: pendiente de proveedor.
- **Copias de seguridad**: `scripts/backup.ps1` (retención) y
  `scripts/restore.ps1` (verificado: 80 casos, identidad OK), fuera de git.
- **Verificación**: `scripts/smoke.ps1` (32 comprobaciones de rutas, CSV y
  aislamiento) + `pnpm typecheck` + `pnpm test` + `next build`.
- **`case_000056`**: descartado ("corrupto": el modelo no devuelve JSON válido);
  queda sin enriquecer y **no se reintenta** sin permiso nuevo.
