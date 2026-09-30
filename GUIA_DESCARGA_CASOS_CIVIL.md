# GUÍA DE TRABAJO DIARIO
## Descarga y documentación de 80 casos de civil (CENDOJ) — mezcla de ramas

---

## 0. REGLA DE ORO ANTES DE EMPEZAR

```
- Manual, clic a clic. Nada de scripts ni herramientas automatizadas.
- Repartido en sesiones de varios días (10-15 casos/sesión), no todo de golpe.
- Uso no comercial / fase de demo, mientras no vendas el producto.
- Objetivo total: 80 casos. Límite legal sin licencia: <100.
```

---

## 1. DÓNDE BUSCAR

**URL:** https://www.poderjudicial.es/search/indexAN.jsp (Buscador CENDOJ)

Pasos de acceso:
1. Entra en el buscador.
2. Acepta el aviso legal.
3. Ve a "Búsqueda avanzada" (no la simple, para poder combinar filtros).
4. En el formulario, rellena el campo de **texto libre** (a veces etiquetado "Texto a buscar" o similar) con el término de turno — no el campo "Voces" (ese es un tesauro de descriptores asignados por CENDOJ, no texto libre que tú escribas; con él te dejas resultados fuera).

---

## 2. FILTROS A USAR

En cada búsqueda:

```
Jurisdicción: Civil
Órgano: (según el día, ver reparto en sección 3)
Fecha: opcional, puedes limitar a los últimos 10-15 años para
       jurisprudencia más actual y citable
Texto libre: uno de los términos de la lista de la sección 4
```

Una búsqueda por término, no varios a la vez — si no, se pierden coincidencias o salen resultados demasiado genéricos.

---

## 3. REPARTO DE LOS 80 CASOS

### 3.1 Por rama (mezcla variada, ~20 por rama)

```
20  Contractual / mercantil general
20  Cláusulas abusivas y consumidores
20  Arrendamientos y propiedad
20  Responsabilidad civil (daños)
```

### 3.2 Por órgano (cruza con lo anterior, dentro de cada rama)

```
~25-30  Tribunal Supremo, Sala 1ª (civil)     → doctrina consolidada
~45-50  Audiencias Provinciales                → volumen y variedad de supuestos
~5-10   TSJ (solo si aparece derecho civil foral/autonómico relevante) → opcional
```

En civil, a diferencia de penal, la Audiencia Nacional no aplica — la sustituyes por más peso en Audiencias Provinciales.

### 3.3 Plan día a día (10-15 casos/sesión, ~6-7 sesiones)

```
Día 1: 10-12  Contractual/mercantil (TS + AP)
Día 2: 10-12  Contractual/mercantil (completar) + iniciar cláusulas abusivas
Día 3: 10-15  Cláusulas abusivas y consumidores
Día 4: 10-15  Cláusulas abusivas (completar) + iniciar arrendamientos/propiedad
Día 5: 10-15  Arrendamientos y propiedad
Día 6: 10-15  Responsabilidad civil (daños)
Día 7: resto  Responsabilidad civil (completar) + TSJ si procede
```

---

## 4. TÉRMINOS DE BÚSQUEDA POR RAMA

### Contractual / mercantil general
```
incumplimiento contractual
resolución de contrato
compraventa mercantil
nulidad contractual
interpretación del contrato
cláusula penal
contrato de agencia
contrato de suministro
disolución de sociedad
responsabilidad de administradores sociales
```

### Cláusulas abusivas y consumidores
```
cláusula suelo
gastos hipotecarios
cláusula abusiva
IRPH
vencimiento anticipado préstamo hipotecario
condiciones generales de la contratación
nulidad de cláusula abusiva
préstamo hipotecario multidivisa
comisión de apertura
```

### Arrendamientos y propiedad
```
arrendamiento urbano
desahucio por falta de pago
propiedad horizontal
servidumbre
usucapión
acción reivindicatoria
comunidad de propietarios
arrendamiento rústico
división de la cosa común
```

### Responsabilidad civil (daños)
```
responsabilidad civil extracontractual
responsabilidad civil médica
negligencia profesional
accidente de circulación indemnización
daño moral
responsabilidad civil por productos defectuosos
responsabilidad civil de abogados/procuradores
culpa in vigilando
```

---

## 5. QUÉ HACER CON CADA CASO (uno a uno)

### 5.1 Descarga
- Abre la ficha de la resolución en el buscador.
- Descarga el PDF con el botón de descarga oficial de la ficha (nunca "imprimir a PDF" ni capturas).

### 5.2 Copia los metadatos de la ficha
```
ROJ
ECLI
Id Cendoj
Órgano
Sede
Sección
Fecha de resolución
Ponente
Tipo de resolución / procedimiento
Número de recurso
Número de resolución
```

### 5.3 Comprueba la firmeza
- Busca si existe una resolución posterior sobre el mismo procedimiento (casación si es de Audiencia Provincial).
- Si no la encuentras: `finality_status = UNKNOWN` (nunca `FIRM` por defecto).
- Si la encuentras y confirma: `FIRM`. Si la revoca: `REVOKED_ON_APPEAL` o `PARTIALLY_REVOKED`.

### 5.4 Calcula el hash del PDF
Mac/Linux:
```bash
sha256sum judgment.pdf
```
Windows (PowerShell):
```powershell
Get-FileHash judgment.pdf -Algorithm SHA256
```

---

## 6. ESTRUCTURA DE CARPETAS POR CASO

```
CASE-000001/
    original/
        judgment.pdf
    metadata/
        case.json
    extracted/
        judgment.txt
    structured/
        facts.json
        arguments.json
        evidence.json
    verification/
        review.json
```

### Plantilla `case.json`

```json
{
  "case_id": "CASE-000001",
  "source_type": "PUBLIC",
  "source": "CENDOJ",
  "source_url": "https://www.poderjudicial.es/...",
  "roj": "",
  "ecli": "",
  "id_cendoj": "",
  "court": "",
  "court_hierarchy_level": "SUPREME_COURT | HIGH_COURT_OF_JUSTICE | PROVINCIAL_COURT | ...",
  "seat": "",
  "section": "",
  "resolution_date": "",
  "rapporteur": "",
  "procedure_type": "",
  "appeal_number": "",
  "resolution_number": "",
  "civil_branch": "CONTRACTUAL | CONSUMER_ABUSIVE_CLAUSES | LEASE_PROPERTY | CIVIL_LIABILITY",
  "finality_status": "FIRM | APPEALED_PENDING | REVOKED_ON_APPEAL | UNKNOWN",
  "retrieval_date": "",
  "retrieved_by": "",
  "usage_context": "non-commercial demo phase, <100 threshold",
  "sha256": "",
  "search_term_used": ""
}
```

### Plantilla `review.json` (verificación)

```json
{
  "case_id": "CASE-000001",
  "court_checked": true,
  "date_checked": true,
  "procedure_number_checked": true,
  "result_checked": true,
  "finality_checked": true,
  "notes": ""
}
```

---

## 7. HOJA DE CONTROL DIARIA (una fila por caso)

```
case_id | fecha_descarga | sesion_dia | rama_civil | roj | organo | termino_busqueda | finality_status | sha256_ok (sí/no)
```

Te permite saber cuántos llevas de 80 sin contar carpetas y demuestra que el ritmo fue gradual y manual, día a día — tu respaldo documental del uso no comercial.

---

## 8. AL TERMINAR CADA SESIÓN DIARIA

```
[ ] Todos los PDF descargados están en su carpeta original/
[ ] Todos los case.json rellenados, incluido civil_branch
[ ] Todos los hashes SHA-256 calculados y guardados
[ ] Firmeza comprobada (o marcada UNKNOWN) en cada caso
[ ] Hoja de control actualizada con los casos de hoy
[ ] Recuento total actualizado (¿cuántos llevas de 80?) y por rama
```

---

## 9. CUANDO LLEGUES A 80

- Para ahí. No sigas "por si acaso" — el margen de 20 respecto al límite de 100 es justo para eso.
- Comprueba que las 4 ramas quedan razonablemente equilibradas (~20 cada una); si una se ha quedado corta, prioriza esa en las últimas sesiones en vez de sumar más de otra que ya tenga suficiente.
- Si más adelante necesitas más casos, pide presupuesto de la licencia-tipo al CENDOJ en vez de seguir bajo el supuesto sin licencia.
- Con 80 casos repartidos en 4 ramas puedes hablar de "ejemplos representativos" por rama en la demo, pero sigue siendo muestra pequeña — no la presentes como "detección de patrones estadísticos" todavía.
